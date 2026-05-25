import React, { useEffect, useRef, forwardRef } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
  autoPlay?: boolean;
}

// WebGL pristine-sampling upscaler
class Anime4KWebGL {
  private gl: WebGLRenderingContext;
  private denoiseProgram: WebGLProgram;
  private upscaleProgram: WebGLProgram;
  private refineProgram: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  public isActive = false;
  private targetHeight: number = 1440; // Default: 2K (2560x1440)
  private sharpStrength: number = 1.5;
  private edgeStrength: number = 3.0;

  // Framebuffers and textures for the 3-pass pipeline
  private fbo1: WebGLFramebuffer | null = null;
  private fbo1Texture: WebGLTexture | null = null;
  private fbo2: WebGLFramebuffer | null = null;
  private fbo2Texture: WebGLTexture | null = null;

  private lastVideoWidth = 0;
  private lastVideoHeight = 0;
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

    // Shared vertical pass clip vertex shader
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // PASS 1: Low-overhead edge-preserving bilateral denoise (runs at source video resolution)
    const fsDenoiseSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;

      void main() {
        vec2 texel = vec2(1.0) / u_textureSize;
        vec4 center = texture2D(u_image, v_texCoord);
        
        vec3 sumColor = center.rgb;
        float sumWeight = 1.0;
        
        vec2 offsets[8];
        offsets[0] = vec2(-1.0, -1.0);
        offsets[1] = vec2(0.0, -1.0);
        offsets[2] = vec2(1.0, -1.0);
        offsets[3] = vec2(-1.0, 0.0);
        offsets[4] = vec2(1.0, 0.0);
        offsets[5] = vec2(-1.0, 1.0);
        offsets[6] = vec2(0.0, 1.0);
        offsets[7] = vec2(1.0, 1.0);

        for(int i = 0; i < 8; i++) {
          vec2 tc = v_texCoord + offsets[i] * texel;
          vec4 sampleCol = texture2D(u_image, tc);
          
          float d_color = length(sampleCol.rgb - center.rgb);
          float w_color = exp(-d_color * d_color * 18.0);
          
          float d_spatial = length(offsets[i]);
          float w_spatial = exp(-d_spatial * d_spatial * 0.4);
          
          float w = w_color * w_spatial;
          sumColor += sampleCol.rgb * w;
          sumWeight += w;
        }
        
        gl_FragColor = vec4(sumColor / sumWeight, center.a);
      }
    `;

    // PASS 2: High-Fidelity 16-sample Bicubic Catmull-Rom upscale to target resolution
    const fsUpscaleSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;

      vec4 bicubicSample(sampler2D image, vec2 uv, vec2 texSize) {
        vec2 texel = vec2(1.0) / texSize;
        vec2 st = uv * texSize - 0.5;
        vec2 i_st = floor(st);
        vec2 f_st = fract(st);

        vec2 w0 = f_st * (-0.5 + f_st * (1.0 - 0.5 * f_st));
        vec2 w1 = 1.0 + f_st * f_st * (-2.5 + 1.5 * f_st);
        vec2 w2 = f_st * (0.5 + f_st * (2.0 - 1.5 * f_st));
        vec2 w3 = f_st * f_st * (-0.5 + 0.5 * f_st);

        vec2 p0 = (i_st - vec2(0.5)) * texel;
        vec2 p1 = (i_st + vec2(0.5)) * texel;
        vec2 p2 = (i_st + vec2(1.5)) * texel;
        vec2 p3 = (i_st + vec2(2.5)) * texel;

        vec4 col = vec4(0.0);

        col += texture2D(image, vec2(p0.x, p0.y)) * w0.x * w0.y;
        col += texture2D(image, vec2(p1.x, p0.y)) * w1.x * w0.y;
        col += texture2D(image, vec2(p2.x, p0.y)) * w2.x * w0.y;
        col += texture2D(image, vec2(p3.x, p0.y)) * w3.x * w0.y;

        col += texture2D(image, vec2(p0.x, p1.y)) * w0.x * w1.y;
        col += texture2D(image, vec2(p1.x, p1.y)) * w1.x * w1.y;
        col += texture2D(image, vec2(p2.x, p1.y)) * w2.x * w1.y;
        col += texture2D(image, vec2(p3.x, p1.y)) * w3.x * w1.y;

        col += texture2D(image, vec2(p0.x, p2.y)) * w0.x * w2.y;
        col += texture2D(image, vec2(p1.x, p2.y)) * w1.x * w2.y;
        col += texture2D(image, vec2(p2.x, p2.y)) * w2.x * w2.y;
        col += texture2D(image, vec2(p3.x, p2.y)) * w3.x * w2.y;

        col += texture2D(image, vec2(p0.x, p3.y)) * w0.x * w3.y;
        col += texture2D(image, vec2(p1.x, p3.y)) * w1.x * w3.y;
        col += texture2D(image, vec2(p2.x, p3.y)) * w2.x * w3.y;
        col += texture2D(image, vec2(p3.x, p3.y)) * w3.x * w3.y;

        return col;
      }

      void main() {
        gl_FragColor = bicubicSample(u_image, v_texCoord, u_textureSize);
      }
    `;

    // PASS 3: High-Fidelity Edge Thinning, Adaptive Contrast & Sharpening with Multi-Scale Step-Sizing
    const fsRefineSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize; // Target resolution (e.g., 3840x2160)
      uniform vec2 u_sourceSize;  // Source resolution (e.g., 1280x720)
      uniform float u_sharpStrength;
      uniform float u_edgeStrength;

      void main() {
        vec2 texTarget = vec2(1.0) / u_textureSize;
        vec2 tc = v_texCoord;

        // Base upscaled color
        vec4 c = texture2D(u_image, tc);

        // Compute local gradient at high resolution with a 1.5-texel step for optimal sensitivity
        vec2 stepSize = texTarget * 1.5;

        float t_y  = dot(texture2D(u_image, tc + vec2(0.0, -stepSize.y)).rgb, vec3(0.299, 0.587, 0.114));
        float b_y  = dot(texture2D(u_image, tc + vec2(0.0, stepSize.y)).rgb,  vec3(0.299, 0.587, 0.114));
        float l_y  = dot(texture2D(u_image, tc + vec2(-stepSize.x, 0.0)).rgb,  vec3(0.299, 0.587, 0.114));
        float r_y  = dot(texture2D(u_image, tc + vec2(stepSize.x, 0.0)).rgb,   vec3(0.299, 0.587, 0.114));
        
        float tl_y = dot(texture2D(u_image, tc + vec2(-stepSize.x, -stepSize.y)).rgb, vec3(0.299, 0.587, 0.114));
        float tr_y = dot(texture2D(u_image, tc + vec2(stepSize.x, -stepSize.y)).rgb,  vec3(0.299, 0.587, 0.114));
        float bl_y = dot(texture2D(u_image, tc + vec2(-stepSize.x, stepSize.y)).rgb,  vec3(0.299, 0.587, 0.114));
        float br_y = dot(texture2D(u_image, tc + vec2(stepSize.x, stepSize.y)).rgb,   vec3(0.299, 0.587, 0.114));

        float g_x = tl_y + 2.0 * l_y + bl_y - tr_y - 2.0 * r_y - br_y;
        float g_y = tl_y + 2.0 * t_y + tr_y - bl_y - 2.0 * b_y - br_y;
        float grad = sqrt(g_x * g_x + g_y * g_y);

        // Clamping envelope from direct neighbors to avoid ringing/halos
        vec3 t_rgb = texture2D(u_image, tc + vec2(0.0, -stepSize.y)).rgb;
        vec3 b_rgb = texture2D(u_image, tc + vec2(0.0, stepSize.y)).rgb;
        vec3 l_rgb = texture2D(u_image, tc + vec2(-stepSize.x, 0.0)).rgb;
        vec3 r_rgb = texture2D(u_image, tc + vec2(stepSize.x, 0.0)).rgb;

        vec3 min_color = min(c.rgb, min(min(t_rgb, b_rgb), min(l_rgb, r_rgb)));
        vec3 max_color = max(c.rgb, max(max(t_rgb, b_rgb), max(l_rgb, r_rgb)));

        // Unsharp Masking using local high-frequency difference
        vec3 blurred = (t_rgb + b_rgb + l_rgb + r_rgb) * 0.25;
        float sharp_activity = clamp(grad * 12.0, 0.01, 1.0);
        vec3 sharp_color = c.rgb + (c.rgb - blurred) * u_sharpStrength * sharp_activity;
        vec3 local_sharpened = clamp(sharp_color, min_color, max_color);

        // Edge push / Line Thinning along the gradient vector
        vec3 final_color = local_sharpened;
        if (grad > 0.01) {
          vec2 texSource = vec2(1.0) / u_sourceSize;
          vec2 dir = vec2(g_x, g_y) / (grad + 0.0001);
          // Shift coordinates towards the center of the line relative to original source pixel size
          vec2 tc_shifted = tc - dir * texSource * (u_edgeStrength * 0.15);
          vec4 shifted_sample = texture2D(u_image, tc_shifted);
          vec3 thinned_color = clamp(shifted_sample.rgb, min_color, max_color);

          float edge_mix = clamp(grad * u_edgeStrength * 1.8, 0.0, 0.95);
          final_color = mix(local_sharpened, thinned_color, edge_mix);
        }

        // Cinematic contrast adjustment on dark lines (perfect for anime contours)
        vec3 lumaWeight = vec3(0.299, 0.587, 0.114);
        float final_y = dot(final_color, lumaWeight);
        if (final_y < 0.45) {
          float contrast_factor = 1.0 - (0.45 - final_y) * 0.35;
          final_color = final_color * contrast_factor;
        }

        gl_FragColor = vec4(final_color, c.a);
      }
    `;

    this.denoiseProgram = this.createProgram(vsSource, fsDenoiseSource);
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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

    // Get actual player dimensions in screen pixels for absolute pixel-perfect output (prevents browser downscale blur)
    const rect = this.video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    let displayWidth = rect.width > 0 ? rect.width : (width / dpr);
    let displayHeight = rect.height > 0 ? rect.height : (height / dpr);

    let targetWidth = Math.round(displayWidth * dpr);
    let targetHeight = Math.round(displayHeight * dpr);

    // Limit target size up to user-selected quality target max (e.g. 1080 or 2160)
    if (targetHeight > this.targetHeight) {
      targetHeight = this.targetHeight;
      targetWidth = Math.round(targetHeight * aspectRatio);
    }

    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.gl.viewport(0, 0, targetWidth, targetHeight);
  }

  private setupFBOs(vWidth: number, vHeight: number, tWidth: number, tHeight: number) {
    const gl = this.gl;
    if (
      this.fbo1 &&
      this.fbo1Texture &&
      this.fbo2 &&
      this.fbo2Texture &&
      this.lastVideoWidth === vWidth &&
      this.lastVideoHeight === vHeight &&
      this.lastTargetWidth === tWidth &&
      this.lastTargetHeight === tHeight
    ) {
      return;
    }

    this.destroyFBOs();

    this.lastVideoWidth = vWidth;
    this.lastVideoHeight = vHeight;
    this.lastTargetWidth = tWidth;
    this.lastTargetHeight = tHeight;

    // FBO 1: At Source Resolution (Denoise target)
    this.fbo1 = gl.createFramebuffer();
    this.fbo1Texture = gl.createTexture();
    if (!this.fbo1 || !this.fbo1Texture) throw new Error("FBO1 allocation failure");

    gl.bindTexture(gl.TEXTURE_2D, this.fbo1Texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, vWidth, vHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbo1Texture, 0);

    // FBO 2: At Target Resolution (Upscale target)
    this.fbo2 = gl.createFramebuffer();
    this.fbo2Texture = gl.createTexture();
    if (!this.fbo2 || !this.fbo2Texture) throw new Error("FBO2 allocation failure");

    gl.bindTexture(gl.TEXTURE_2D, this.fbo2Texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tWidth, tHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbo2Texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private destroyFBOs() {
    const gl = this.gl;
    if (this.fbo1) gl.deleteFramebuffer(this.fbo1);
    if (this.fbo1Texture) gl.deleteTexture(this.fbo1Texture);
    if (this.fbo2) gl.deleteFramebuffer(this.fbo2);
    if (this.fbo2Texture) gl.deleteTexture(this.fbo2Texture);

    this.fbo1 = null;
    this.fbo1Texture = null;
    this.fbo2 = null;
    this.fbo2Texture = null;
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
    this.render();
    this.animId = requestAnimationFrame(this.loop);
  };

  private render() {
    if (this.video.readyState < this.video.HAVE_CURRENT_DATA) return;
    const gl = this.gl;

    const vWidth = this.video.videoWidth || 1280;
    const vHeight = this.video.videoHeight || 720;
    const tWidth = this.canvas.width;
    const tHeight = this.canvas.height;

    // Direct initialization/adjustment of Framebuffers
    this.setupFBOs(vWidth, vHeight, tWidth, tHeight);

    // Setup geometry buffers
    const pos = gl.getAttribLocation(this.denoiseProgram, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    // -----------------------------------------------------
    // PASS 1: Bilateral Denoise -> FBO 1 (At Source Size)
    // -----------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo1);
    gl.viewport(0, 0, vWidth, vHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.video
    );

    gl.useProgram(this.denoiseProgram);
    gl.uniform1i(gl.getUniformLocation(this.denoiseProgram, "u_image"), 0);
    gl.uniform2f(
      gl.getUniformLocation(this.denoiseProgram, "u_textureSize"),
      vWidth,
      vHeight
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // -----------------------------------------------------
    // PASS 2: Catmull-Rom upscale of denoised FBO 1 Texture -> FBO 2
    // -----------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo2);
    gl.viewport(0, 0, tWidth, tHeight);

    gl.bindTexture(gl.TEXTURE_2D, this.fbo1Texture);

    gl.useProgram(this.upscaleProgram);
    gl.uniform1i(gl.getUniformLocation(this.upscaleProgram, "u_image"), 0);
    gl.uniform2f(
      gl.getUniformLocation(this.upscaleProgram, "u_textureSize"),
      vWidth,
      vHeight
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // -----------------------------------------------------
    // PASS 3: Sobel Refining, Contour Thinning, and Adaptive Sharpening -> Screen
    // -----------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, tWidth, tHeight);

    gl.bindTexture(gl.TEXTURE_2D, this.fbo2Texture);

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
    if (this.denoiseProgram) gl.deleteProgram(this.denoiseProgram);
    if (this.upscaleProgram) gl.deleteProgram(this.upscaleProgram);
    if (this.refineProgram) gl.deleteProgram(this.refineProgram);
    this.destroyFBOs();
  }
}

export const CustomPlayer = forwardRef<HTMLVideoElement, CustomPlayerProps>(
  ({ src, maxAudioTracks, audioTrackNames, autoPlay }, ref) => {
    const artRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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
                      html: "1080p",
                      level: maxLevelIdx,
                      isUpscale: true,
                      default: false,
                    });
                  }

                  if (!hasNative4K) {
                    qualitiesList.push({
                      html: "4K",
                      level: maxLevelIdx,
                      isUpscale: true,
                      default: false,
                    });
                  }

                  // Determine the upscale or best quality to set as initial default
                  const defaultItem =
                    qualitiesList.find((q) => q.html === "4K") ||
                    qualitiesList.find((q) => q.html === "1080p") ||
                    qualitiesList[qualitiesList.length - 1]; // Highest standard available

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
                          item.html.includes("1080") ||
                          item.html.includes("4K");
                        if (isTargetUpscale) {
                          if (webglInstance) {
                            if (item.html.includes("1080")) {
                              webglInstance.setTargetHeight(1080);
                              webglInstance.setStrength(1.5, 3.0);
                            } else {
                              webglInstance.setTargetHeight(2160); // 4K resolution
                              webglInstance.setStrength(2.8, 4.5); // Extra crisp line refinement
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
                      (selectedQualityHtml.includes("1080") ||
                        selectedQualityHtml.includes("4K"))
                    ) {
                      if (selectedQualityHtml.includes("1080")) {
                        webglInstance.setTargetHeight(1080);
                        webglInstance.setStrength(1.5, 3.0);
                      } else {
                        webglInstance.setTargetHeight(2160);
                        webglInstance.setStrength(2.8, 4.5);
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
                          webglInstance.setStrength(1.5, 3.0);
                        } else {
                          webglInstance.setTargetHeight(2160);
                          webglInstance.setStrength(2.8, 4.5);
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
        if (art && art.destroy) {
          art.destroy(false);
        }
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }, [src, ref, maxAudioTracks, audioTrackNames, autoPlay]);

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
      </div>
    );
  },
);

CustomPlayer.displayName = "CustomPlayer";
