import React, { useEffect, useRef, forwardRef, useState } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import { FastForward, ChevronRight } from "lucide-react";

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
  autoPlay?: boolean;
  animeId?: string;
  episodeNumber?: string;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

// WebGL pristine-sampling upscaler
class Anime4KWebGL {
  private gl: WebGLRenderingContext;
  private upscaleProgram: WebGLProgram;
  private refineProgram: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  public isActive = false;
  private targetHeight: number = 1080; // Default: 1080p for stability
  private sharpStrength: number = 0.6; // Gentle halo-free baseline
  private edgeStrength: number = 0.8;  // Safe geometry baseline

  // Framebuffer and texture for the 2-pass pipeline
  private fbo1: WebGLFramebuffer | null = null;
  private fbo1Texture: WebGLTexture | null = null;

  private lastTargetWidth = 0;
  private lastTargetHeight = 0;

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.canvas = canvas;
    this.video = video;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      depth: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      throw new Error("WebGL is not supported in this environment");
    }
    this.gl = gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Shared vertical pass clip vertex shader
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + vec2(0.5);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // PASS 1: High-Fidelity Lanczos-2 Crisp Upscaler
    const fsUpscaleSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize; // Source video resolution (e.g., 1280x720)

      float sinc(float x) {
        if (abs(x) < 0.0001) return 1.0;
        float pi_x = 3.1415926535 * x;
        return sin(pi_x) / pi_x;
      }

      float lanczos2(float x) {
        if (abs(x) >= 2.0) return 0.0;
        return sinc(x) * sinc(x * 0.5);
      }

      void main() {
        vec2 texel = vec2(1.0) / u_textureSize;
        vec2 pos = v_texCoord * u_textureSize - 0.5;
        vec2 i_pos = floor(pos);
        vec2 f_pos = pos - i_pos;

        vec3 sum = vec3(0.0);
        float w_sum = 0.0;

        for (float y = -1.0; y <= 2.0; y += 1.0) {
          float w_y = lanczos2(f_pos.y - y);
          for (float x = -1.0; x <= 2.0; x += 1.0) {
            float w_x = lanczos2(f_pos.x - x);
            float weight = w_x * w_y;
            
            vec2 sample_uv = (i_pos + vec2(x, y) + 0.5) * texel;
            sample_uv = clamp(sample_uv, 0.5 * texel, 1.0 - 0.5 * texel);
            vec3 color = texture2D(u_image, sample_uv).rgb;
            
            sum += color * weight;
            w_sum += weight;
          }
        }

        vec3 final_color = abs(w_sum) > 0.01 ? clamp(sum / w_sum, 0.0, 1.0) : texture2D(u_image, v_texCoord).rgb;
        gl_FragColor = vec4(final_color, 1.0);
      }
    `;

    // PASS 2: Crisp Anime Contour Thinning (Warp) & Sharp Edge Reconstruction
    const fsRefineSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;    // Target upscaled resolution (e.g. 3840x2160)
      uniform vec2 u_sourceSize;     // Original video resolution (e.g. 1280x720)
      uniform float u_sharpStrength;
      uniform float u_edgeStrength;

      float get_luma(vec3 col) {
        return dot(col, vec3(0.299, 0.587, 0.114));
      }

      void main() {
        vec2 texel = vec2(1.0) / u_textureSize;
        vec2 tc = v_texCoord;

        // Base upscaled frame
        vec4 original = texture2D(u_image, tc);
        
        // Step size for Sobel gradient computation.
        // Limit step size to keep edge detection extremely sharp at 4K.
        float scale = max(u_textureSize.y / u_sourceSize.y, 1.0);
        vec2 d = texel * clamp(0.8 * scale, 1.0, 1.5);

        // Get luma values in 3x3 neighborhood
        float tl = get_luma(texture2D(u_image, tc + vec2(-d.x, d.y)).rgb);
        float t  = get_luma(texture2D(u_image, tc + vec2(0.0, d.y)).rgb);
        float tr = get_luma(texture2D(u_image, tc + vec2(d.x, d.y)).rgb);
        
        float l  = get_luma(texture2D(u_image, tc + vec2(-d.x, 0.0)).rgb);
        float r  = get_luma(texture2D(u_image, tc + vec2(d.x, 0.0)).rgb);
        
        float bl = get_luma(texture2D(u_image, tc + vec2(-d.x, -d.y)).rgb);
        float b  = get_luma(texture2D(u_image, tc + vec2(0.0, -d.y)).rgb);
        float br = get_luma(texture2D(u_image, tc + vec2(d.x, -d.y)).rgb);

        // Standard Sobel operator for gradient vector
        float g_x = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
        float g_y = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
        float grad = sqrt(g_x * g_x + g_y * g_y);

        vec3 final_color = original.rgb;

        // Perform gradient warp (thinning) on detected edges
        if (grad > 0.01 && u_edgeStrength > 0.01) {
          // dir points from dark line outward to bright background
          vec2 dir = vec2(g_x, g_y) / (grad + 0.0001);

          // Shift texture coordinates outward to thin the dark line.
          // Clamp the scaling multiplier to avoid over-distortion or blurriness on 4K.
          float warp_scale = clamp(0.5 * scale, 1.0, 1.8);
          vec2 shift = dir * texel * (u_edgeStrength * warp_scale);
          vec2 tc_shifted = tc + shift;

          vec3 shifted_color = texture2D(u_image, tc_shifted).rgb;

          // Highly localized neighborhood clamping (using tight 2x2 or 4-tap box) to ensure razor sharp, halo-free boundaries
          vec2 clamp_d = texel * 1.2;
          vec3 c_t = texture2D(u_image, tc + vec2(0.0, clamp_d.y)).rgb;
          vec3 c_b = texture2D(u_image, tc + vec2(0.0, -clamp_d.y)).rgb;
          vec3 c_l = texture2D(u_image, tc + vec2(-clamp_d.x, 0.0)).rgb;
          vec3 c_r = texture2D(u_image, tc + vec2(clamp_d.x, 0.0)).rgb;

          vec3 min_color = min(original.rgb, min(min(c_t, c_b), min(c_l, c_r)));
          vec3 max_color = max(original.rgb, max(max(c_t, c_b), max(c_l, c_r)));

          shifted_color = clamp(shifted_color, min_color, max_color);

          // Smoothly apply thinning proportional to contour edge sharpness
          float edge_mix = clamp(grad * 12.0, 0.0, 1.0);
          final_color = mix(final_color, shifted_color, edge_mix);
        }

        gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), original.a);
      }
    `;

    this.upscaleProgram = this.createProgram(vsSource, fsUpscaleSource);
    this.refineProgram = this.createProgram(vsSource, fsRefineSource);

    // Geometry buffer definition
    const geomBuffer = gl.createBuffer();
    if (!geomBuffer) throw new Error("WebGL buffer creation error");
    this.buffer = geomBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, geomBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    // Frame buffer texture definition
    const texIndex = gl.createTexture();
    if (!texIndex) throw new Error("WebGL texture allocation error");
    this.texture = texIndex;
    gl.bindTexture(gl.TEXTURE_2D, texIndex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    const prg = gl.createProgram();
    if (!prg) throw new Error("Program instantiation failed");
    gl.attachShader(prg, vs);
    gl.attachShader(prg, fs);
    gl.linkProgram(prg);

    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
      throw new Error(
        `Shader linking compilation failure: ${gl.getProgramInfoLog(prg)}`,
      );
    }
    return prg;
  }

  public setTargetHeight(h: number) {
    this.targetHeight = h;
    if (this.isActive) {
      this.resize();
    }
  }

  public setStrength(sharp: number, edge: number) {
    this.sharpStrength = sharp;
    this.edgeStrength = edge;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Shader creation error");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`GLSL compilation error: ${err}`);
    }
    return shader;
  }

  private onSeeking = () => {
    this.canvas.style.opacity = "0";
    this.video.style.opacity = "1";
  };

  private onWaiting = () => {
    this.canvas.style.opacity = "0";
    this.video.style.opacity = "1";
  };

  private onPlaying = () => {
    if (this.isActive) {
      this.canvas.style.opacity = "1";
      this.video.style.opacity = "0";
    }
  };

  private onSeeked = () => {
    if (
      this.isActive &&
      this.video.readyState >= this.video.HAVE_CURRENT_DATA
    ) {
      if (!this.video.seeking) {
        this.canvas.style.opacity = "1";
        this.video.style.opacity = "0";
      }
    }
  };

  public resize() {
    const width = this.video.videoWidth || 1280;
    const height = this.video.videoHeight || 720;
    const aspectRatio = width / height;

    // Use the explicit user-selected upscaling resolution (e.g. 1080 or 2160) for internal canvas resolution
    // to force high-fidelity WebGL upscaling instead of downscaled CSS-only stretching
    const targetHeight = this.targetHeight;
    const targetWidth = Math.round(targetHeight * aspectRatio);

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.gl.viewport(0, 0, targetWidth, targetHeight);
  }

  private setupFBOs(tWidth: number, tHeight: number) {
    const gl = this.gl;
    if (
      this.fbo1 &&
      this.fbo1Texture &&
      this.lastTargetWidth === tWidth &&
      this.lastTargetHeight === tHeight
    ) {
      return;
    }

    this.destroyFBOs();

    this.lastTargetWidth = tWidth;
    this.lastTargetHeight = tHeight;

    // FBO 1: At Target Resolution (Upscale target)
    this.fbo1 = gl.createFramebuffer();
    this.fbo1Texture = gl.createTexture();
    if (!this.fbo1 || !this.fbo1Texture) throw new Error("FBO1 allocation failure");

    gl.bindTexture(gl.TEXTURE_2D, this.fbo1Texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tWidth, tHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbo1Texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private destroyFBOs() {
    const gl = this.gl;
    if (this.fbo1) gl.deleteFramebuffer(this.fbo1);
    if (this.fbo1Texture) gl.deleteTexture(this.fbo1Texture);

    this.fbo1 = null;
    this.fbo1Texture = null;
  }

  public start() {
    if (this.isActive) return;
    this.isActive = true;
    this.resize();

    this.video.addEventListener("seeking", this.onSeeking);
    this.video.addEventListener("waiting", this.onWaiting);
    this.video.addEventListener("playing", this.onPlaying);
    this.video.addEventListener("seeked", this.onSeeked);

    if (
      this.video.readyState >= this.video.HAVE_CURRENT_DATA &&
      !this.video.seeking
    ) {
      this.canvas.style.opacity = "1";
      this.video.style.opacity = "0";
    } else {
      this.canvas.style.opacity = "0";
      this.video.style.opacity = "1";
    }

    this.loop();
  }

  public stop() {
    this.isActive = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    this.video.removeEventListener("seeking", this.onSeeking);
    this.video.removeEventListener("waiting", this.onWaiting);
    this.video.removeEventListener("playing", this.onPlaying);
    this.video.removeEventListener("seeked", this.onSeeked);

    this.canvas.style.opacity = "0";
    this.video.style.opacity = "1";
  }

  private loop = () => {
    if (!this.isActive) return;
    try {
      this.render();
      this.animId = requestAnimationFrame(this.loop);
    } catch (e) {
      console.warn("[Anime4K WebGL] Rendering failed, gracefully disabling scale filter:", e);
      this.stop();
    }
  };

  private render() {
    if (this.video.readyState < this.video.HAVE_CURRENT_DATA) return;
    const gl = this.gl;

    const vWidth = this.video.videoWidth || 1280;
    const vHeight = this.video.videoHeight || 720;
    const aspectRatio = vWidth / vHeight;

    // Direct pixel-perfect auto-resize inside frame loop to handle sizing dynamically using selected targetHeight
    const targetHeight = this.targetHeight;
    const targetWidth = Math.round(targetHeight * aspectRatio);

    // Immediately adjust canvas buffer size if anything changed (including fullscreen toggle)
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      gl.viewport(0, 0, targetWidth, targetHeight);
    }

    const tWidth = this.canvas.width;
    const tHeight = this.canvas.height;

    // Allocate/rebuild the FBO to match target width and height
    this.setupFBOs(tWidth, tHeight);

    // Setup geometry buffers
    const pos = gl.getAttribLocation(this.upscaleProgram, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    // -----------------------------------------------------
    // PASS 1: Catmull-Rom upscale of original video texture -> FBO 1 (At Target Size)
    // -----------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo1);
    gl.viewport(0, 0, tWidth, tHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    // Upload current frame of video stream to WebGL texture
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.video
    );

    gl.useProgram(this.upscaleProgram);
    gl.uniform1i(gl.getUniformLocation(this.upscaleProgram, "u_image"), 0);
    gl.uniform2f(
      gl.getUniformLocation(this.upscaleProgram, "u_textureSize"),
      vWidth,
      vHeight
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // -----------------------------------------------------
    // PASS 2: Line Art Refining & Super-Resolution -> Screen Framebuffer (null)
    // -----------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, tWidth, tHeight);

    gl.bindTexture(gl.TEXTURE_2D, this.fbo1Texture);

    gl.useProgram(this.refineProgram);
    gl.uniform1i(gl.getUniformLocation(this.refineProgram, "u_image"), 0);
    gl.uniform2f(
      gl.getUniformLocation(this.refineProgram, "u_textureSize"),
      tWidth,
      tHeight
    );
    gl.uniform2f(
      gl.getUniformLocation(this.refineProgram, "u_sourceSize"),
      vWidth,
      vHeight
    );
    gl.uniform1f(
      gl.getUniformLocation(this.refineProgram, "u_sharpStrength"),
      this.sharpStrength
    );
    gl.uniform1f(
      gl.getUniformLocation(this.refineProgram, "u_edgeStrength"),
      this.edgeStrength
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public destroy() {
    this.stop();
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.upscaleProgram) gl.deleteProgram(this.upscaleProgram);
    if (this.refineProgram) gl.deleteProgram(this.refineProgram);
    this.destroyFBOs();
  }
}

export const CustomPlayer = forwardRef<HTMLVideoElement, CustomPlayerProps>(
  ({ src, maxAudioTracks, audioTrackNames, autoPlay, animeId, episodeNumber, onNextEpisode, onPrevEpisode }, ref) => {
    const artRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const artInstanceRef = useRef<Artplayer | null>(null);

    const [showSkipOpening, setShowSkipOpening] = useState(false);
    const [showSkipEnding, setShowSkipEnding] = useState(false);
    const [preciseSkips, setPreciseSkips] = useState<{ start: number | null; end: number | null; outro_start: number | null; outro_end: number | null } | null>(null);
    const preciseSkipsRef = useRef<{ start: number | null; end: number | null; outro_start: number | null; outro_end: number | null } | null>(null);

    useEffect(() => {
      preciseSkipsRef.current = preciseSkips;
    }, [preciseSkips]);

    useEffect(() => {
      if (src && src.includes("/api/media/playlist")) {
        let isCurrent = true;
        let originalKodikUrl = "";
        try {
          const urlObj = new URL(src, window.location.origin);
          originalKodikUrl = urlObj.searchParams.get("url") || "";
        } catch (e) {}
        
        if (originalKodikUrl) {
          const skipQueryUrl = `/api/media/skip-timings?url=${encodeURIComponent(originalKodikUrl)}` + 
            (animeId ? `&animeId=${encodeURIComponent(animeId)}` : "") + 
            (episodeNumber ? `&episode=${encodeURIComponent(episodeNumber)}` : "");
          
          fetch(skipQueryUrl)
            .then((res) => res.json())
            .then((data) => {
              if (isCurrent && data && data.normalized) {
                setPreciseSkips(data.normalized);
                console.log("[KODIK PRECISE SKIPS] Loaded:", data.normalized);
              }
            })
            .catch((err) => console.error("[KODIK PRECISE SKIPS] Failed to load:", err));
        }
        return () => {
          isCurrent = false;
        };
      } else {
        setPreciseSkips(null);
      }
    }, [src]);

    useEffect(() => {
      if (!artRef.current) return;

      let art: Artplayer | null = null;
      let blobUrl: string | null = null;
      let isCancelled = false;
      let webglInstance: Anime4KWebGL | null = null;
      let selectedQualityHtml = "4K";

      const initPlayer = async () => {
        let finalUrl = src;

        // Rewrite manifest in case of m3u8 path mappings
        if (maxAudioTracks && src.endsWith(".m3u8")) {
          try {
            const res = await fetch(src);
            const text = await res.text();
            const baseUrl = src.substring(0, src.lastIndexOf("/") + 1);

            const lines = text.replace(/\r/g, "").split("\n");
            let audioCount = 0;
            const newLines = lines
              .map((line) => {
                if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
                  audioCount++;
                  if (audioCount > maxAudioTracks) return null;
                }
                if (line.includes('URI="')) {
                  return line.replace(/URI="([^"]+)"/, (match, uri) => {
                    if (!uri.startsWith("http") && !uri.startsWith("/"))
                      return `URI="${baseUrl}${uri}"`;
                    return match;
                  });
                }
                if (
                  line &&
                  !line.startsWith("#") &&
                  !line.startsWith("http") &&
                  !line.startsWith("/")
                ) {
                  return baseUrl + line;
                }
                return line;
              })
              .filter((l) => l !== null);

            const blob = new Blob([newLines.join("\n")], {
              type: "application/vnd.apple.mpegurl",
            });
            blobUrl = URL.createObjectURL(blob);
            finalUrl = blobUrl;
          } catch (e) {
            console.error("Failed to rewrite manifest", e);
          }
        }

        if (isCancelled || !artRef.current) return;

        art = new Artplayer({
          container: artRef.current,
          url: finalUrl,
          type:
            src.includes(".m3u8") || src.includes("/playlist")
              ? "m3u8"
              : undefined,
          theme: "#E11D48",
          volume: 0.7,
          moreVideoAttr: {
            crossOrigin: "anonymous",
          },
          autoplay: autoPlay || false,
          pip: true,
          autoSize: true,
          autoMini: false,
          screenshot: true,
          setting: true,
          playbackRate: true,
          aspectRatio: true,
          fullscreen: true,
          fullscreenWeb: true,
          miniProgressBar: true,
          lang: "ru",
          i18n: {
            ru: {
              "Play Speed": "Скорость воспроизведения",
              "Aspect Ratio": "Соотношение сторон",
              Default: "По умолчанию",
              Normal: "Обычная",
              Settings: "Настройки",
              Play: "Запуск",
              Pause: "Пауза",
              Volume: "Громкость",
              Mute: "Заглушить",
              Screenshot: "Скриншот",
              Fullscreen: "Во весь экран",
              "Exit Fullscreen": "Выйти из полноэкранного режима",
              "Web Fullscreen": "В окне браузера",
              "Exit Web Fullscreen": "Выйти из режима окна",
              "PIP Mode": "Картинка в картинке",
              "Exit PIP Mode": "Закрыть картинку в картинке",
              Flip: "Поворот",
              "Video Info": "Служебная информация",
            },
          } as any,
          controls: [
            ...(onPrevEpisode
              ? [
                  {
                    name: "prev-episode",
                    position: "left",
                    index: 11,
                    html: `
                      <span class="art-icon art-icon-prev-ep" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin-right: 2px; color: #fff;" title="Предыдущая серия">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="19 20 9 12 19 4 19 20" fill="currentColor"></polygon>
                          <line x1="5" y1="19" x2="5" y2="5"></line>
                        </svg>
                      </span>
                    `,
                    click: function () {
                      onPrevEpisode();
                    },
                  },
                ]
              : []),
            ...(onNextEpisode
              ? [
                  {
                    name: "next-episode",
                    position: "left",
                    index: 12,
                    html: `
                      <span class="art-icon art-icon-next-ep" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; color: #fff;" title="Следующая серия">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"></polygon>
                          <line x1="19" y1="5" x2="19" y2="19"></line>
                        </svg>
                      </span>
                    `,
                    click: function () {
                      onNextEpisode();
                    },
                  },
                ]
              : []),
          ],
          layers: [
            {
              name: "play-pause-layer",
              html: "",
              style: { display: "none" },
            },
          ],
          customType: {
            m3u8: function (video, url, artInstance) {
              if (Hls.isSupported()) {
                if ((artInstance as any).hls)
                  (artInstance as any).hls.destroy();
                const hls = new Hls({
                  maxMaxBufferLength: 30,
                  maxBufferSize: 60 * 1000 * 1000,
                });
                (artInstance as any).hls = hls;
                hls.attachMedia(video);
                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                  hls.loadSource(url);
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                  if (data.fatal) {
                     console.error(
                      "HLS.js fatal error:",
                      data.type,
                      data.details,
                    );

                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        console.warn("[HLS RECOVERY] Fatal network error: Attempting to recover by calling startLoad()...");
                        hls.startLoad();
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.warn("[HLS RECOVERY] Fatal media error (e.g. fragParsingError): Attempting to recover by calling recoverMediaError()...");
                        hls.recoverMediaError();
                        break;
                      default:
                        console.error("[HLS RECOVERY] Unrecoverable fatal error: Re-initialising stream...");
                        artInstance.notice.show = "Ошибка воспроизведения, перезапуск...";
                        hls.destroy();
                        hls.loadSource(url);
                        break;
                    }
                    if (
                      data.details ===
                        Hls.ErrorDetails.MANIFEST_PARSING_ERROR ||
                      (data.details &&
                        data.details.toLowerCase().includes("parsing"))
                    ) {
                      console.warn(
                        "[HLS DIAGNOSTIC] manifestParsingError detected. Attempting to fetch raw manifest from:",
                        url,
                      );
                      fetch(url)
                        .then((r) => r.text())
                        .then((txt) => {
                          console.error("[HLS DIAGNOSTIC] RAW MANIFEST BODY:");
                          console.error(txt);
                        })
                        .catch((err) => {
                          console.error(
                            "[HLS DIAGNOSTIC] Failed to fetch raw manifest text:",
                            err,
                          );
                        });
                    }
                  }
                });

                let isQualityAdded = false;
                hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                  if (isQualityAdded) return;
                  isQualityAdded = true;

                  const getQualityName = (level: any) => {
                    const width = level.width || 0;
                    const height = level.height || 0;
                    if (width >= 3800 || height >= 1500) return "4K";
                    if (width >= 1900 || height >= 800) return "1080p";
                    if (width >= 1200 || height >= 500) return "720p";
                    if (width >= 800 || height >= 400) return "480p";
                    if (width >= 600 || height >= 300) return "360p";
                    return height ? height + "p" : "Неизвестно";
                  };

                  const levels = data.levels || hls.levels;
                  const standardQualities = levels.map(
                    (l: any, index: number) => ({
                      html: getQualityName(l),
                      level: index,
                      isUpscale: false,
                      default: false,
                    }),
                  );

                  const maxLevelIdx = levels.length - 1;
                  const qualitiesList = [...standardQualities];

                  const hasNative1080 = standardQualities.some((q) =>
                    q.html.includes("1080"),
                  );
                  const hasNative4K = standardQualities.some((q) =>
                    q.html.includes("4K"),
                  );

                  if (!hasNative1080) {
                    qualitiesList.push({
                      html: "1080p (Anime4K Upscale)",
                      level: maxLevelIdx,
                      isUpscale: true,
                      default: false,
                    });
                  }

                  if (!hasNative4K) {
                    qualitiesList.push({
                      html: "4K (Anime4K Upscale)",
                      level: maxLevelIdx,
                      isUpscale: true,
                      default: false,
                    });
                  }

                  // Determine the upscale or best quality to set as initial default
                  // By default, set the highest standard native quality available to guarantee zero black-screen issues out of the box.
                  const defaultItem =
                    standardQualities.find((q) => q.html === "1080p") ||
                    standardQualities.find((q) => q.html === "720p") ||
                    standardQualities[standardQualities.length - 1] ||
                    qualitiesList[qualitiesList.length - 1];

                  if (defaultItem) {
                    defaultItem.default = true;
                    selectedQualityHtml = defaultItem.html;
                  }

                  // Show highest qualities first
                  qualitiesList.reverse();

                  if (qualitiesList.length > 0) {
                    const defaultItemInReversed =
                      qualitiesList.find((q) => q.default) || qualitiesList[0];
                    artInstance.setting.add({
                      name: "quality",
                      html: "Качество",
                      width: 220,
                      tooltip: defaultItemInReversed.html,
                      selector: qualitiesList,
                      onSelect: function (item) {
                        hls.nextLevel = item.level;
                        selectedQualityHtml = item.html;

                        const isTargetUpscale =
                          item.html.includes("Anime4K Upscale");
                        if (isTargetUpscale) {
                          if (webglInstance) {
                            if (item.html.includes("1080")) {
                              webglInstance.setTargetHeight(1080);
                              webglInstance.setStrength(1.2, 0.8);
                            } else {
                              webglInstance.setTargetHeight(2160); // 4K resolution
                              webglInstance.setStrength(1.6, 1.2);
                            }
                            webglInstance.start();
                          }
                        } else {
                          if (webglInstance) {
                            webglInstance.stop();
                          }
                        }
                        return item.html;
                      },
                    });

                    // Trigger initial WebGL upscaling immediately if webglInstance is already initialized
                    if (
                      webglInstance &&
                      (selectedQualityHtml.includes("Anime4K Upscale"))
                    ) {
                      if (selectedQualityHtml.includes("1080")) {
                        webglInstance.setTargetHeight(1080);
                        webglInstance.setStrength(1.2, 0.8);
                      } else {
                        webglInstance.setTargetHeight(2160);
                        webglInstance.setStrength(1.6, 1.2);
                      }
                      webglInstance.start();
                    }
                  }
                });

                let isAudioAdded = false;
                hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
                  if (isAudioAdded) return;
                  isAudioAdded = true;

                  let tracks = data.audioTracks.map((t, index) => ({
                    html:
                      audioTrackNames && audioTrackNames[index]
                        ? audioTrackNames[index]
                        : t.name ||
                          (t as any).language ||
                          `Озвучка ${index + 1}`,
                    trackId: index,
                    default: index === hls.audioTrack,
                  }));

                  if (tracks.length > 1) {
                    artInstance.setting.add({
                      name: "audio",
                      html: "Озвучка",
                      width: 250,
                      tooltip:
                        tracks.find((t) => t.default)?.html || tracks[0].html,
                      selector: tracks,
                      onSelect: function (item) {
                        hls.audioTrack = item.trackId;
                        if (artInstance && artInstance.video) {
                          artInstance.video.dispatchEvent(
                            new CustomEvent("audiotrackchange", {
                              detail: item.trackId,
                            }),
                          );
                        }
                        return item.html;
                      },
                    });
                  }
                });

                artInstance.on("ready", () => {
                  const findSetting = (names: string[]) => {
                    for (const n of names) {
                      const found =
                        (artInstance.setting as any).get?.(n) ||
                        (artInstance.setting as any).find?.(n) ||
                        (artInstance.setting as any).get?.(n.toLowerCase());
                      if (found) return found;
                    }
                    return null;
                  };

                  const playbackRateSetting = findSetting([
                    "playbackRate",
                    "playback-rate",
                    "rate",
                  ]);
                  if (playbackRateSetting) {
                    playbackRateSetting.html = "Скорость";
                  }
                  const aspectRatioSetting = findSetting([
                    "aspectRatio",
                    "aspect-ratio",
                    "ratio",
                  ]);
                  if (aspectRatioSetting) {
                    aspectRatioSetting.html = "Соотношение сторон";
                  }

                  // Link WebGL Anime4K engine to the actual player video element
                  const videoEl = artInstance.video;
                  const isNative4K =
                    src.toLowerCase().includes("proxy-4k") ||
                    src.toLowerCase().includes("kamianime") ||
                    src.toLowerCase().includes("suzume") ||
                    src.toLowerCase().includes("weathering") ||
                    src.toLowerCase().includes("garden_of_words") ||
                    src.toLowerCase().includes("kimi-no-na-wa");

                  if (canvasRef.current && videoEl && !isNative4K) {
                    try {
                      const videoContainer = videoEl.parentElement;
                      if (videoContainer) {
                        videoContainer.appendChild(canvasRef.current);
                        canvasRef.current.setAttribute(
                          "style",
                          "position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transition: opacity 0.3s ease; opacity: 0; z-index: 5;",
                        );
                      }

                      webglInstance = new Anime4KWebGL(
                        canvasRef.current,
                        videoEl,
                      );
                      if (
                        selectedQualityHtml &&
                        (selectedQualityHtml.includes("1080") ||
                          selectedQualityHtml.includes("4K"))
                      ) {
                        if (selectedQualityHtml.includes("1080")) {
                          webglInstance.setTargetHeight(1080);
                          webglInstance.setStrength(1.2, 0.8);
                        } else {
                          webglInstance.setTargetHeight(2160);
                          webglInstance.setStrength(1.6, 1.2);
                        }
                        webglInstance.start();
                      } else {
                        webglInstance.stop();
                      }
                    } catch (e) {
                      console.error("Anime4K WebGL Initialization Error:", e);
                    }
                  }
                });

                artInstance.on("destroy", () => hls.destroy());
              } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = url;
              }
            },
          },
        });

        artInstanceRef.current = art;

        // Save position and control overlay visibility
        art.on("video:timeupdate", () => {
          if (!art) return;
          const t = art.currentTime;
          const d = art.duration;

          if (animeId && episodeNumber && t > 5 && Math.floor(t) % 5 === 0) {
            localStorage.setItem(`anime_progress_${animeId}_${episodeNumber}`, t.toString());
          }

          const skips = preciseSkipsRef.current;
          // Show skip opening triggers
          if (skips && typeof skips.start === 'number' && typeof skips.end === 'number') {
            setShowSkipOpening(t >= skips.start && t < skips.end);
          } else {
            setShowSkipOpening(t > 5 && t < 185);
          }

          // Show skip ending triggers (last 3 minutes of episode or precise outro)
          if (skips && typeof skips.outro_start === 'number') {
            const outEnd = typeof skips.outro_end === 'number' ? skips.outro_end : d;
            setShowSkipEnding(t >= skips.outro_start && t < outEnd);
          } else {
            setShowSkipEnding(d > 185 && t > d - 180 && t < d - 10);
          }
        });

        art.on("video:pause", () => {
          if (!art) return;
          if (animeId && episodeNumber && art.currentTime > 5) {
            localStorage.setItem(`anime_progress_${animeId}_${episodeNumber}`, art.currentTime.toString());
          }
        });

        // Restore playback position on load
        art.on("ready", () => {
          if (!art) return;
          if (animeId && episodeNumber) {
            const saved = localStorage.getItem(`anime_progress_${animeId}_${episodeNumber}`);
            if (saved) {
              const seekTime = parseFloat(saved);
              if (!isNaN(seekTime) && seekTime > 5) {
                art.currentTime = seekTime;
                art.notice.show = `Продолжено с ${Math.floor(seekTime / 60)}:${Math.floor(seekTime % 60).toString().padStart(2, "0")}`;
              }
            }
          }
        });

        if (typeof ref === "function") {
          (art.video as any).art = art;
          ref(art.video);
        } else if (ref) {
          (art.video as any).art = art;
          ref.current = art.video;
        }
      };

      initPlayer();

      return () => {
        isCancelled = true;
        if (webglInstance) {
          webglInstance.destroy();
        }
        if (art) {
          if (animeId && episodeNumber && art.currentTime > 5) {
            localStorage.setItem(`anime_progress_${animeId}_${episodeNumber}`, art.currentTime.toString());
          }
          if (art.destroy) {
            art.destroy(false);
          }
        }
        artInstanceRef.current = null;
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }, [src, ref, maxAudioTracks, audioTrackNames, autoPlay, animeId, episodeNumber, onNextEpisode, onPrevEpisode]);

    const handleSkipOpening = () => {
      const art = artInstanceRef.current;
      if (art) {
        if (preciseSkips && typeof preciseSkips.end === 'number') {
          art.currentTime = preciseSkips.end;
          art.notice.show = "Пропущен опенинг";
        } else {
          art.currentTime = Math.min(art.currentTime + 85, art.duration);
          art.notice.show = "Пропущено 85 секунд (опенинг)";
        }
      }
    };

    const handleSkipEnding = () => {
      if (onNextEpisode) {
        onNextEpisode();
      } else {
        const art = artInstanceRef.current;
        if (art) {
          if (preciseSkips && typeof preciseSkips.outro_end === 'number') {
            art.currentTime = preciseSkips.outro_end;
          } else {
            art.currentTime = art.duration;
          }
        }
      }
    };

    return (
      <div className="relative w-full aspect-video rounded-xl bg-black overflow-hidden group/player">
        {/* Invisible HTML5 video element strictly for SEO crawlers to discover static video URLs */}
        {src && (
          <video
            className="sr-only"
            style={{ display: "none" }}
            preload="none"
            controls
          >
            <source src={src} type="application/x-mpegURL" />
            Ваш браузер не поддерживает HLS видео.
          </video>
        )}
        <div ref={artRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          style={{ pointerEvents: "none", transition: "opacity 0.3s ease" }}
          className="absolute inset-0 w-full h-full object-contain opacity-0 z-10"
        />

        {/* OVERLAYS FOR SKIP OPENING/ENDING */}
        {showSkipOpening && (
          <button
            onClick={handleSkipOpening}
            className="absolute bottom-16 left-6 p-3 px-5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 hover:border-primary/50 text-white flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xl text-[11px] font-bold uppercase tracking-wider z-[40]"
          >
            <FastForward className="w-4 h-4 text-primary animate-pulse" />
            Пропустить опенинг (+85с)
          </button>
        )}

        {showSkipEnding && (
          <button
            onClick={handleSkipEnding}
            className="absolute bottom-16 right-6 p-3 px-5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 hover:border-primary/50 text-white flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xl text-[11px] font-bold uppercase tracking-wider z-[40]"
          >
            Пропустить эндинг
            <ChevronRight className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>
    );
  },
);

CustomPlayer.displayName = "CustomPlayer";
