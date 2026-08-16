import React, { useEffect, useRef, forwardRef, useState } from "react";
import Artplayer from "artplayer";
import Hls from "hls.js";
import {
  FastForward,
  SkipForward,
  StepForward,
  Settings,
  Gauge,
  PictureInPicture2,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Play,
  Pause,
  Maximize2,
  Sliders,
} from "lucide-react";

export const isTvDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /TV|SmartTV|Tizen|WebOS|VIDAA|Android.*TV|HbbTV|CrKey|Roku|AppleTV|BRAVIA|NetCast|GoogleTV|Opera TV|Viera|SmartHub|Large Screen/i.test(ua);
};

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
  autoPlay?: boolean;
  animeId?: string;
  episodeNumber?: string;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  onPlayerError?: () => void;
}

// WebGL pristine-sampling 1080p upscaler for crisp anime lines
class AnimeWebGL1080p {
  private gl: WebGLRenderingContext;
  private upscaleProgram: WebGLProgram;
  private refineProgram: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  public isActive = false;

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
      throw new Error("WebGL is not supported");
    }
    this.gl = gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + vec2(0.5);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsUpscaleSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;

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

    const fsRefineSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_targetResolution;

      void main() {
        vec2 d = vec2(1.0) / u_targetResolution;
        vec3 c  = texture2D(u_image, v_texCoord).rgb;
        vec3 cU = texture2D(u_image, v_texCoord + vec2(0.0, -d.y)).rgb;
        vec3 cD = texture2D(u_image, v_texCoord + vec2(0.0,  d.y)).rgb;
        vec3 cL = texture2D(u_image, v_texCoord + vec2(-d.x, 0.0)).rgb;
        vec3 cR = texture2D(u_image, v_texCoord + vec2( d.x, 0.0)).rgb;

        vec3 sharp = c * 5.0 - (cU + cD + cL + cR);
        vec3 minColor = min(c, min(min(cU, cD), min(cL, cR)));
        vec3 maxColor = max(c, max(max(cU, cD), max(cL, cR)));
        sharp = clamp(sharp, minColor, maxColor);

        vec3 finalColor = mix(c, sharp, 0.6);
        gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
      }
    `;

    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const createProg = (vs: string, fs: string) => {
      const p = gl.createProgram()!;
      gl.attachShader(p, createShader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, createShader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      return p;
    };

    this.upscaleProgram = createProg(vsSource, fsUpscaleSource);
    this.refineProgram = createProg(vsSource, fsRefineSource);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
  }

  private initFBOs(width: number, height: number) {
    const gl = this.gl;
    if (this.fbo1) this.destroyFBOs();
    this.lastTargetWidth = width;
    this.lastTargetHeight = height;

    this.fbo1Texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fbo1Texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.fbo1 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fbo1Texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private destroyFBOs() {
    const gl = this.gl;
    if (this.fbo1Texture) gl.deleteTexture(this.fbo1Texture);
    if (this.fbo1) gl.deleteFramebuffer(this.fbo1);
    this.fbo1Texture = null;
    this.fbo1 = null;
  }

  public start() {
    if (this.isActive) return;
    this.isActive = true;
    this.canvas.style.opacity = "1";
    this.renderLoop();
  }

  public stop() {
    this.isActive = false;
    this.canvas.style.opacity = "0";
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private renderLoop = () => {
    if (!this.isActive) return;
    this.render();
    this.animId = requestAnimationFrame(this.renderLoop);
  };

  private render() {
    const video = this.video;
    const gl = this.gl;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const targetH = 1080;
    const aspect = vW / vH;
    const targetW = Math.round(targetH * aspect);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    if (this.lastTargetWidth !== targetW || this.lastTargetHeight !== targetH) {
      this.initFBOs(targetW, targetH);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // Pass 1: Upscale to 1080p
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo1);
    gl.viewport(0, 0, targetW, targetH);
    gl.useProgram(this.upscaleProgram);

    const posLoc1 = gl.getAttribLocation(this.upscaleProgram, "a_position");
    gl.enableVertexAttribArray(posLoc1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.vertexAttribPointer(posLoc1, 2, gl.FLOAT, false, 0, 0);

    const texLoc1 = gl.getUniformLocation(this.upscaleProgram, "u_image");
    gl.uniform1i(texLoc1, 0);
    const sizeLoc1 = gl.getUniformLocation(this.upscaleProgram, "u_textureSize");
    gl.uniform2f(sizeLoc1, vW, vH);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 2: Line sharpening
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, targetW, targetH);
    gl.useProgram(this.refineProgram);

    const posLoc2 = gl.getAttribLocation(this.refineProgram, "a_position");
    gl.enableVertexAttribArray(posLoc2);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbo1Texture);
    const texLoc2 = gl.getUniformLocation(this.refineProgram, "u_image");
    gl.uniform1i(texLoc2, 0);

    const resLoc = gl.getUniformLocation(this.refineProgram, "u_targetResolution");
    gl.uniform2f(resLoc, targetW, targetH);
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
  (
    {
      src,
      maxAudioTracks,
      audioTrackNames,
      autoPlay,
      animeId,
      episodeNumber,
      onNextEpisode,
      onPrevEpisode,
      onPlayerError,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const artRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const artInstanceRef = useRef<Artplayer | null>(null);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState<"main" | "quality" | "speed">("main");

    // Player Preferences (Stored in localStorage)
    const [selectedQuality, setSelectedQuality] = useState<string>("Авто");
    const [availableQualities, setAvailableQualities] = useState<
      { html: string; level: number }[]
    >([
      { html: "Авто", level: -1 },
      { html: "1080p", level: 0 },
      { html: "720p", level: 1 },
      { html: "480p", level: 2 },
      { html: "360p", level: 3 },
    ]);

    const [selectedSpeed, setSelectedSpeed] = useState<number>(1.0);
    const speedOptions = [
      { label: "0.5x", value: 0.5 },
      { label: "0.75x", value: 0.75 },
      { label: "Обычная (1.0x)", value: 1.0 },
      { label: "1.25x", value: 1.25 },
      { label: "1.5x", value: 1.5 },
      { label: "1.75x", value: 1.75 },
      { label: "2.0x", value: 2.0 },
    ];

    const [autoNext, setAutoNext] = useState<boolean>(() => {
      const v = localStorage.getItem("kami_player_auto_next");
      return v !== null ? v === "true" : true;
    });

    const [skipOpening, setSkipOpening] = useState<boolean>(() => {
      const v = localStorage.getItem("kami_player_skip_op");
      return v !== null ? v === "true" : true;
    });

    const [skipEnding, setSkipEnding] = useState<boolean>(() => {
      const v = localStorage.getItem("kami_player_skip_ed");
      return v !== null ? v === "true" : true;
    });

    const [miniOnScroll, setMiniOnScroll] = useState<boolean>(() => {
      const v = localStorage.getItem("kami_player_mini_scroll");
      return v !== null ? v === "true" : true;
    });

    // Dynamic In-Player Badges
    const [showSkipOpBtn, setShowSkipOpBtn] = useState(false);
    const [showSkipEdBtn, setShowSkipEdBtn] = useState(false);

    // Mini Player on Scroll State
    const [isMiniPlayer, setIsMiniPlayer] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const onNextEpisodeRef = useRef(onNextEpisode);
    const onPrevEpisodeRef = useRef(onPrevEpisode);
    const onPlayerErrorRef = useRef(onPlayerError);
    const audioTrackNamesRef = useRef(audioTrackNames);

    useEffect(() => {
      onNextEpisodeRef.current = onNextEpisode;
    }, [onNextEpisode]);

    useEffect(() => {
      onPrevEpisodeRef.current = onPrevEpisode;
    }, [onPrevEpisode]);

    useEffect(() => {
      onPlayerErrorRef.current = onPlayerError;
    }, [onPlayerError]);

    useEffect(() => {
      audioTrackNamesRef.current = audioTrackNames;
    }, [audioTrackNames]);

    // Handle Mini-Player on Scroll using IntersectionObserver
    useEffect(() => {
      if (!miniOnScroll || !containerRef.current) {
        setIsMiniPlayer(false);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            setIsMiniPlayer(true);
          } else {
            setIsMiniPlayer(false);
          }
        },
        { threshold: 0.15 },
      );

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [miniOnScroll]);

    useEffect(() => {
      if (!artRef.current) return;

      let art: Artplayer | null = null;
      let blobUrl: string | null = null;
      let isCancelled = false;
      let webglInstance: AnimeWebGL1080p | null = null;

      const saveProgress = (t: number, d: number) => {
        if (!animeId || !episodeNumber) return;
        if (t > 5 && Math.floor(t) % 5 === 0) {
          localStorage.setItem(`anime_progress_${animeId}_${episodeNumber}`, t.toString());
        }
        if (d > 0 && t / d >= 0.6) {
          const key = `anime_watched_${animeId}`;
          try {
            const stored = localStorage.getItem(key);
            const watched: string[] = stored ? JSON.parse(stored) : [];
            if (!watched.includes(episodeNumber)) {
              watched.push(episodeNumber);
              localStorage.setItem(key, JSON.stringify(watched));
              window.dispatchEvent(
                new CustomEvent("anime_episode_watched", {
                  detail: { animeId, episode: episodeNumber },
                }),
              );
            }
          } catch (e) {
            console.error(e);
          }
        }
      };

      const initPlayer = async () => {
        let finalUrl = src;

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
          theme: "#8B5CF6", // KamiAnime Signature Violet Color
          volume: 0.7,
          moreVideoAttr: {
            crossOrigin: "anonymous",
          },
          autoplay: autoPlay || false,
          pip: false,
          autoSize: true,
          autoMini: false,
          screenshot: true,
          setting: false, // We supply our dedicated reference popup settings
          playbackRate: true,
          aspectRatio: true,
          fullscreen: true,
          fullscreenWeb: true,
          miniProgressBar: true,
          lang: "ru",
          i18n: {
            ru: {
              "Play Speed": "Скорость",
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
              "Web Fullscreen": "В окне",
              "Exit Web Fullscreen": "Выйти из окна",
            },
          } as any,
          controls: [
            ...(!!onPrevEpisode
              ? [
                  {
                    name: "prev-episode",
                    position: "left",
                    index: 11,
                    html: `
                      <span class="art-icon art-icon-prev-ep" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-right: 2px; color: #fff;" title="Предыдущая серия">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="19 20 9 12 19 4 19 20" fill="currentColor"></polygon>
                          <line x1="5" y1="19" x2="5" y2="5"></line>
                        </svg>
                      </span>
                    `,
                    click: function () {
                      if (onPrevEpisodeRef.current) {
                        onPrevEpisodeRef.current();
                      }
                    },
                  },
                ]
              : []),
            ...(!!onNextEpisode
              ? [
                  {
                    name: "next-episode",
                    position: "left",
                    index: 12,
                    html: `
                      <span class="art-icon art-icon-next-ep" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; color: #fff;" title="Следующая серия">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"></polygon>
                          <line x1="19" y1="5" x2="19" y2="19"></line>
                        </svg>
                      </span>
                    `,
                    click: function () {
                      if (onNextEpisodeRef.current) {
                        onNextEpisodeRef.current();
                      }
                    },
                  },
                ]
              : []),
            {
              name: "custom-settings-btn",
              position: "right",
              index: 20,
              html: `
                <span class="art-icon art-icon-custom-settings" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; color: #fff;" title="Настройки">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </span>
              `,
              click: function () {
                setIsSettingsOpen((prev) => !prev);
              },
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
                    console.error("HLS fatal error:", data.type, data.details);
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                      default:
                        if (artInstance && artInstance.notice) {
                          artInstance.notice.show =
                            "Ошибка потока. Переключаем на запасной плеер...";
                        }
                        if (onPlayerErrorRef.current) {
                          onPlayerErrorRef.current();
                        }
                        break;
                    }
                  }
                });

                let isQualityAdded = false;
                hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                  if (isQualityAdded) return;
                  isQualityAdded = true;

                  const getQualityName = (level: any) => {
                    const height = level.height || 0;
                    if (height >= 1000) return "1080p";
                    if (height >= 700) return "720p";
                    if (height >= 400) return "480p";
                    if (height >= 300) return "360p";
                    return height ? `${height}p` : "Авто";
                  };

                  const levels = data.levels || hls.levels;
                  const parsedQualities: { html: string; level: number }[] = [
                    { html: "Авто", level: -1 },
                  ];

                  levels.forEach((l: any, index: number) => {
                    const name = getQualityName(l);
                    if (!parsedQualities.some((q) => q.html === name)) {
                      parsedQualities.push({ html: name, level: index });
                    }
                  });

                  if (!parsedQualities.some((q) => q.html === "1080p")) {
                    parsedQualities.push({
                      html: "1080p",
                      level: levels.length - 1,
                    });
                  }

                  setAvailableQualities(parsedQualities);
                });

                artInstance.on("ready", () => {
                  const videoEl = artInstance.video;
                  const isTv = isTvDevice();

                  if (canvasRef.current && videoEl && !isTv) {
                    try {
                      const videoContainer = videoEl.parentElement;
                      if (videoContainer) {
                        videoContainer.appendChild(canvasRef.current);
                        canvasRef.current.setAttribute(
                          "style",
                          "position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transition: opacity 0.3s ease; opacity: 0; z-index: 5;",
                        );
                      }

                      webglInstance = new AnimeWebGL1080p(
                        canvasRef.current,
                        videoEl,
                      );
                      webglInstance.start();
                    } catch (e) {
                      console.error("Anime WebGL Initialization Error:", e);
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

        // Track Play / Pause
        art.on("video:play", () => setIsPlaying(true));
        art.on("video:pause", () => setIsPlaying(false));

        // Time updates: Progress, Skip Opening (+85s) & Skip Ending logic
        art.on("video:timeupdate", () => {
          if (!art) return;
          const curr = art.currentTime;
          const dur = art.duration;
          saveProgress(curr, dur);

          // Opening badge: between 10s and 110s
          if (curr >= 10 && curr <= 110) {
            setShowSkipOpBtn(true);
          } else {
            setShowSkipOpBtn(false);
          }

          // Ending badge: in last 85 seconds of the episode (when dur > 180s)
          if (dur > 180 && curr >= dur - 85) {
            setShowSkipEdBtn(true);
          } else {
            setShowSkipEdBtn(false);
          }
        });

        // Auto-switch to next episode when current video ends
        art.on("video:ended", () => {
          const isAutoNextActive =
            localStorage.getItem("kami_player_auto_next") !== "false";
          if (isAutoNextActive && onNextEpisodeRef.current) {
            if (art && art.notice) {
              art.notice.show = "Запуск следующей серии...";
            }
            setTimeout(() => {
              onNextEpisodeRef.current?.();
            }, 800);
          }
        });

        // Restore playback position on load
        art.on("ready", () => {
          if (!art) return;
          if (animeId && episodeNumber) {
            const saved = localStorage.getItem(
              `anime_progress_${animeId}_${episodeNumber}`,
            );
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
            saveProgress(art.currentTime, art.duration);
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
    }, [
      src,
      maxAudioTracks,
      !!audioTrackNames,
      autoPlay,
      animeId,
      episodeNumber,
      !!onNextEpisode,
      !!onPrevEpisode,
    ]);

    // Quality Selection Handler
    const handleSelectQuality = (item: { html: string; level: number }) => {
      setSelectedQuality(item.html);
      const art = artInstanceRef.current;
      if (art && (art as any).hls) {
        (art as any).hls.currentLevel = item.level;
      }
      if (art && art.notice) {
        art.notice.show = `Качество: ${item.html}`;
      }
      setActiveSubmenu("main");
    };

    // Speed Selection Handler
    const handleSelectSpeed = (speedVal: number, label: string) => {
      setSelectedSpeed(speedVal);
      const art = artInstanceRef.current;
      if (art) {
        art.playbackRate = speedVal;
        if (art.notice) {
          art.notice.show = `Скорость: ${label}`;
        }
      }
      setActiveSubmenu("main");
    };

    // Skip Opening Action (+85s)
    const handleSkipOpening = () => {
      const art = artInstanceRef.current;
      if (art) {
        art.currentTime += 85;
        if (art.notice) {
          art.notice.show = "+85s Пропуск опенинга";
        }
      }
      setShowSkipOpBtn(false);
    };

    // Skip Ending Action -> Jump to Next Episode
    const handleSkipEnding = () => {
      if (onNextEpisodeRef.current) {
        onNextEpisodeRef.current();
      }
    };

    // Download Episode Action
    const handleDownloadEpisode = () => {
      const art = artInstanceRef.current;
      if (art && art.notice) {
        art.notice.show = "Подготовка файла к загрузке...";
      }
      // Check if we can direct download or trigger bot/stream
      if (src) {
        const link = document.createElement("a");
        link.href = src;
        link.download = `anime_${animeId || "video"}_ep_${episodeNumber || "1"}.mp4`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setIsSettingsOpen(false);
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-[1.5rem] md:rounded-[2rem] bg-black overflow-hidden group/player select-none"
      >
        {/* Invisible HTML5 video element strictly for SEO crawlers */}
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

        {/* Primary Artplayer Container */}
        <div ref={artRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          style={{ pointerEvents: "none", transition: "opacity 0.3s ease" }}
          className="absolute inset-0 w-full h-full object-contain opacity-0 z-10"
        />

        {/* Dynamic Quick Skip Opening Badge (+85s) */}
        {skipOpening && showSkipOpBtn && (
          <div className="absolute bottom-16 left-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={handleSkipOpening}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/80 hover:bg-[#8B5CF6] text-white border border-white/20 hover:border-[#8B5CF6] font-sans font-bold text-xs shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4 text-[#8B5CF6] group-hover:text-white" />
              <span>Пропустить опенинг (+85s)</span>
            </button>
          </div>
        )}

        {/* Dynamic Quick Skip Ending Badge (Next Episode) */}
        {skipEnding && showSkipEdBtn && (
          <div className="absolute bottom-16 right-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={handleSkipEnding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border border-[#8B5CF6] font-sans font-bold text-xs shadow-2xl transition-all active:scale-95 cursor-pointer"
            >
              <span>Следующая серия</span>
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top-Right Quick Settings Floating Button for Instant Access */}
        <button
          onClick={() => {
            setActiveSubmenu("main");
            setIsSettingsOpen(true);
          }}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-xl bg-black/60 hover:bg-black/80 text-white/75 hover:text-white border border-white/10 hover:border-[#8B5CF6]/50 flex items-center justify-center backdrop-blur-md opacity-0 group-hover/player:opacity-100 transition-all duration-200 cursor-pointer"
          title="Настройки плеера"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* REFERENCE-PERFECT POPUP SETTINGS MODAL / BOTTOM SHEET */}
        {isSettingsOpen && (
          <div
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsSettingsOpen(false);
                setActiveSubmenu("main");
              }
            }}
          >
            <div
              className="w-full sm:max-w-md bg-[#121318] border border-white/10 rounded-t-[1.75rem] sm:rounded-[1.75rem] p-5 sm:p-6 shadow-2xl font-sans text-white animate-in slide-in-from-bottom-5 duration-200 max-h-[90%] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle line pill */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

              {/* MAIN MENU */}
              {activeSubmenu === "main" && (
                <div className="flex flex-col gap-1">
                  {/* Header: Title & Done Button */}
                  <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      Настройки
                    </h3>
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className="text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer px-2 py-1"
                    >
                      Готово
                    </button>
                  </div>

                  {/* 1. Качество */}
                  <button
                    onClick={() => setActiveSubmenu("quality")}
                    className="flex items-center justify-between py-3 px-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80 group-hover:text-[#8B5CF6] transition-colors">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Качество
                        </div>
                        <div className="text-xs text-slate-400">
                          {selectedQuality}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  {/* 2. Скорость */}
                  <button
                    onClick={() => setActiveSubmenu("speed")}
                    className="flex items-center justify-between py-3 px-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80 group-hover:text-[#8B5CF6] transition-colors">
                        <Gauge className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          Скорость
                        </div>
                        <div className="text-xs text-slate-400">
                          {selectedSpeed === 1.0
                            ? "Обычная"
                            : `${selectedSpeed}x`}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  <div className="my-2 border-t border-white/5" />

                  {/* 3. Авто-переключение */}
                  <div className="flex items-center justify-between py-2.5 px-2.5 rounded-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
                        <StepForward className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-white">
                        Авто-переключение
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newVal = !autoNext;
                        setAutoNext(newVal);
                        localStorage.setItem(
                          "kami_player_auto_next",
                          String(newVal),
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoNext ? "bg-[#8B5CF6]" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          autoNext ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* 4. Пропуск опенинга */}
                  <div className="flex items-center justify-between py-2.5 px-2.5 rounded-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
                        <FastForward className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-white">
                        Пропуск опенинга
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newVal = !skipOpening;
                        setSkipOpening(newVal);
                        localStorage.setItem(
                          "kami_player_skip_op",
                          String(newVal),
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        skipOpening ? "bg-[#8B5CF6]" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          skipOpening ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* 5. Пропуск эндинга */}
                  <div className="flex items-center justify-between py-2.5 px-2.5 rounded-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
                        <SkipForward className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-white">
                        Пропуск эндинга
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newVal = !skipEnding;
                        setSkipEnding(newVal);
                        localStorage.setItem(
                          "kami_player_skip_ed",
                          String(newVal),
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        skipEnding ? "bg-[#8B5CF6]" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          skipEnding ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* 6. Мини-плеер при скролле */}
                  <div className="flex items-center justify-between py-2.5 px-2.5 rounded-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
                        <PictureInPicture2 className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-white">
                        Мини-плеер при скролле
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const newVal = !miniOnScroll;
                        setMiniOnScroll(newVal);
                        localStorage.setItem(
                          "kami_player_mini_scroll",
                          String(newVal),
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        miniOnScroll ? "bg-[#8B5CF6]" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          miniOnScroll ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="my-2 border-t border-white/5" />

                  {/* 7. Скачать серию */}
                  <button
                    onClick={handleDownloadEpisode}
                    className="flex items-center justify-between py-3 px-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/80 group-hover:text-[#8B5CF6] transition-colors">
                        <Download className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-white">
                        Скачать серию
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>
                </div>
              )}

              {/* SUBMENU: КАЧЕСТВО */}
              {activeSubmenu === "quality" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
                    <button
                      onClick={() => setActiveSubmenu("main")}
                      className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Качество</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setActiveSubmenu("main");
                      }}
                      className="text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer px-2 py-1"
                    >
                      Готово
                    </button>
                  </div>

                  <div className="space-y-1">
                    {availableQualities.map((q) => {
                      const isSelected = selectedQuality === q.html;
                      return (
                        <button
                          key={q.html}
                          onClick={() => handleSelectQuality(q)}
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span>{q.html}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#8B5CF6]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBMENU: СКОРОСТЬ */}
              {activeSubmenu === "speed" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
                    <button
                      onClick={() => setActiveSubmenu("main")}
                      className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Скорость</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        setActiveSubmenu("main");
                      }}
                      className="text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer px-2 py-1"
                    >
                      Готово
                    </button>
                  </div>

                  <div className="space-y-1">
                    {speedOptions.map((opt) => {
                      const isSelected = selectedSpeed === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() =>
                            handleSelectSpeed(opt.value, opt.label)
                          }
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                              : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#8B5CF6]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FLOATING MINI-PLAYER (Triggered when scrolled down) */}
        {miniOnScroll && isMiniPlayer && (
          <div className="fixed bottom-6 right-6 z-50 w-72 sm:w-80 bg-[#121318] border border-[#8B5CF6]/40 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider text-white truncate">
                  Серия {episodeNumber || "1"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    containerRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Развернуть"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsMiniPlayer(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Закрыть мини-плеер"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 py-2 border-t border-white/5">
              {onPrevEpisode && (
                <button
                  onClick={onPrevEpisode}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  title="Предыдущая серия"
                >
                  <StepForward className="w-4 h-4 rotate-180" />
                </button>
              )}
              <button
                onClick={() => {
                  const art = artInstanceRef.current;
                  if (art) {
                    art.toggle();
                  }
                }}
                className="p-3 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/30 transition-all cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              {onNextEpisode && (
                <button
                  onClick={onNextEpisode}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  title="Следующая серия"
                >
                  <StepForward className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

CustomPlayer.displayName = "CustomPlayer";
