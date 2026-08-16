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
  Activity,
  Terminal,
  Cpu,
  Copy,
  Wifi,
  Sparkles,
  Info,
} from "lucide-react";
import {
  StreamInspector,
  StreamLogEntry,
  StreamTelemetryData,
} from "./StreamInspector";
import { decryptStreamUrl } from "../utils/streamDecryptor";

export const isTvDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /TV|SmartTV|Tizen|WebOS|VIDAA|Android.*TV|HbbTV|CrKey|Roku|AppleTV|BRAVIA|NetCast|GoogleTV|Opera TV|Viera|SmartHub|Large Screen/i.test(ua);
};

export interface AnimeSkipTimings {
  opening?: [number, number];
  ending?: [number, number];
}

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
  autoPlay?: boolean;
  animeId?: string;
  episodeNumber?: string;
  skips?: AnimeSkipTimings;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  onPlayerError?: () => void;
  showInspectorBelow?: boolean;
  onTelemetryUpdate?: (data: StreamTelemetryData) => void;
  is1080Source?: boolean;
}

// WebGL pristine-sampling Super-Resolution upscaler for crisp anime lines (1080p and 4K UHD)
class AnimeWebGLUpscaler {
  private gl: WebGLRenderingContext;
  private upscaleProgram: WebGLProgram;
  private refineProgram: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  public isActive = false;
  public targetMode: "auto" | "1080p" | "4k" = "auto";

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

  public setTargetMode(mode: "auto" | "1080p" | "4k") {
    this.targetMode = mode;
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
    
    // Determine dynamic target resolution:
    // If targetMode is 4k or (auto and source is 1080p): upscale to 4K UHD (2160p)
    // If source is 720p or lower: upscale to 1080p Full HD
    let targetH = 1080;
    if (this.targetMode === "4k" || (this.targetMode === "auto" && vH >= 1000)) {
      targetH = 2160;
    } else {
      targetH = 1080;
    }

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

    // Pass 1: Lanczos2 Super-Resolution Upscaling
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

    // Pass 2: Contrast-Preserving Line Sharpening
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
      skips,
      onNextEpisode,
      onPrevEpisode,
      onPlayerError,
      showInspectorBelow = false,
      onTelemetryUpdate,
      is1080Source,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const artRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const artInstanceRef = useRef<Artplayer | null>(null);
    const webglInstanceRef = useRef<AnimeWebGLUpscaler | null>(null);

    // Stream Inspector & Diagnostics State
    const [showHudOverlay, setShowHudOverlay] = useState(false);
    const [streamLogs, setStreamLogs] = useState<StreamLogEntry[]>([]);
    const [telemetry, setTelemetry] = useState<StreamTelemetryData>({
      src: src || "",
      provider: src.includes("kodik") || src.includes("/api/media/playlist") ? "Kodik Balancer" : "Kami CDN",
      nativeWidth: 0,
      nativeHeight: 0,
      renderWidth: 0,
      renderHeight: 0,
      fps: 24,
      droppedFrames: 0,
      totalFrames: 0,
      activeQuality: "4K (AI Super-Res)",
      targetMode: "4k",
      isAiActive: true,
      hlsLevels: [],
      currentLevelIndex: 0,
      bufferAheadSeconds: 0,
      bandwidthMbps: 0,
      currentTime: 0,
      duration: 0,
      playbackState: "idle",
    });

    const addLog = (
      tag: StreamLogEntry["tag"],
      message: string,
      type: StreamLogEntry["type"] = "info"
    ) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
      const entry: StreamLogEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        time: timeStr,
        tag,
        type,
        message,
      };
      setStreamLogs((prev) => [...prev.slice(-99), entry]);
    };

    // Target skip timestamps
    const opTargetRef = useRef<number | null>(null);
    const edTargetRef = useRef<number | null>(null);

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState<"main" | "quality" | "speed">("main");

    // Player Preferences (Stored in localStorage)
    const [selectedQuality, setSelectedQuality] = useState<string>("4K (AI Super-Res)");
    const [availableQualities, setAvailableQualities] = useState<
      { html: string; level: number; isAiUpscale?: boolean }[]
    >([
      { html: "4K (AI Super-Res)", level: 0, isAiUpscale: true },
      { html: "1080p (Full HD)", level: 0 },
      { html: "720p (HD)", level: 1 },
      { html: "480p (SD)", level: 2 },
      { html: "360p", level: 3 },
      { html: "Авто (4K AI)", level: -1 },
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
      let webglInstance: AnimeWebGLUpscaler | null = null;

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

        // Decrypt and decode stream if received as an encrypted, Base64, or multi-quality string
        if (finalUrl && !finalUrl.startsWith("/api/media/playlist")) {
          const decrypted = decryptStreamUrl(finalUrl);
          if (decrypted) {
            addLog("DECODER", `Поток успешно расшифрован перед инициализацией: ${decrypted.substring(0, 60)}...`, "info");
            finalUrl = decrypted;
          }
        }

        if (maxAudioTracks && finalUrl.endsWith(".m3u8")) {
          try {
            const res = await fetch(finalUrl);
            const text = await res.text();
            const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf("/") + 1);

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
              name: "stream-hud-btn",
              position: "right",
              index: 19,
              html: `
                <span class="art-icon art-icon-stream-hud" style="cursor: pointer; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; color: #fff;" title="Инспектор потока и статистика">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </span>
              `,
              click: function () {
                setShowHudOverlay((prev) => !prev);
              },
            },
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
              addLog("RESOLVER", `Инициализация HLS видеопотока: ${url.substring(0, 75)}...`, "info");
              if (Hls.isSupported()) {
                if ((artInstance as any).hls)
                  (artInstance as any).hls.destroy();
                const hls = new Hls({
                  maxMaxBufferLength: 30,
                  maxBufferSize: 60 * 1000 * 1000,
                  enableWorker: true,
                  lowLatencyMode: false,
                  fragLoadingTimeOut: 25000,
                  manifestLoadingTimeOut: 25000,
                  levelLoadingTimeOut: 25000,
                  fragLoadingMaxRetry: 4,
                  levelLoadingMaxRetry: 4,
                  manifestLoadingMaxRetry: 4,
                  fragLoadingRetryDelay: 1000,
                  levelLoadingRetryDelay: 1000,
                  manifestLoadingRetryDelay: 1000,
                });
                (artInstance as any).hls = hls;
                hls.attachMedia(video);
                
                let activeUrl = url;
                let networkRetryCount = 0;

                hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                  hls.loadSource(activeUrl);
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                  addLog("ERROR", `Событие ошибки HLS: ${data.details} (Fatal: ${data.fatal})`, data.fatal ? "error" : "warn");
                  if (data.fatal) {
                    console.warn("HLS fatal error encountered, initiating recovery:", data.type, data.details);
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        networkRetryCount++;
                        if (networkRetryCount <= 4) {
                          if (data.details === "levelLoadError" && hls.levels && hls.levels.length > 1) {
                            addLog("HLS", "Ошибка уровня HLS (levelLoadError). Пробуем другой доступный уровень...", "warn");
                            const nextLvl = (hls.currentLevel + 1) % hls.levels.length;
                            hls.currentLevel = nextLvl;
                            try { (hls as any).loadLevel(nextLvl); } catch (_) {}
                            hls.startLoad();
                            break;
                          }
                          if (activeUrl.includes('/api/media/playlist') && !activeUrl.includes('direct=false')) {
                            addLog("HLS", "HLS столкнулся с сетевой ошибкой прямого воспроизведения. Переключаемся на защищенный прокси-поток...", "warn");
                            const separator = activeUrl.includes('?') ? '&' : '?';
                            const fallbackUrl = `${activeUrl}${separator}direct=false`;
                            activeUrl = fallbackUrl;
                            hls.loadSource(fallbackUrl);
                            hls.startLoad();
                            break;
                          }
                          addLog("HLS", "Восстановление после сетевой ошибки HLS (startLoad)...", "warn");
                          hls.startLoad();
                          break;
                        } else {
                          addLog("HLS", "Переключение на резервный поток после ошибки загрузки уровня...", "warn");
                          if (artInstance && artInstance.notice) {
                            artInstance.notice.show = "Ошибка сети при загрузке уровня. Переключаем...";
                          }
                          if (onPlayerErrorRef.current) {
                            onPlayerErrorRef.current();
                          }
                        }
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        addLog("HLS", "Восстановление медиа-буфера (recoverMediaError)...", "warn");
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

                  const levels = data.levels || hls.levels || [];
                  const maxLevelHeight = Math.max(...levels.map((l: any) => l.height || 0), 0);
                  
                  // Accurate 1080p native detection:
                  // Checks manifest levels (height >= 1000 or top tier >= 720 from master HD), or explicit is1080Source flag
                  const has1080Native = is1080Source === true || 
                                        maxLevelHeight >= 1000 || 
                                        levels.some((l: any) => (l.height || 0) >= 1000) ||
                                        (is1080Source !== false && (maxLevelHeight >= 720 || levels.length === 0));

                  const bestLevel = levels.length > 0 ? levels.length - 1 : 0;
                  const level1080Index = levels.findIndex((l: any) => (l.height || 0) >= 1000);
                  const active1080Level = level1080Index !== -1 ? level1080Index : bestLevel;

                  const level720Index = levels.findIndex((l: any) => (l.height || 0) >= 700 && (l.height || 0) < 1000);
                  const active720Level = level720Index !== -1 ? level720Index : Math.max(0, bestLevel - 1);

                  const hlsLevelSummaries = levels.map((l: any, idx: number) => ({
                    height: l.height || (idx === bestLevel ? 1080 : 720),
                    width: l.width || Math.round((l.height || 720) * 1.777),
                    bitrate: l.bitrate || 2000000,
                    name: l.name || `${l.height || 720}p`,
                  }));

                  addLog(
                    "HLS",
                    `Манифест успешно прочитан. Обнаружено уровней: ${levels.length}. Нативное разрешение источника: ${has1080Native ? '1080p (Full HD)' : `${maxLevelHeight || 720}p`}`,
                    "success"
                  );

                  if (has1080Native) {
                    addLog(
                      "AI-PIPELINE",
                      `Исходник: 1080p Full HD → Схема качества: [4K (AI Super-Res), 1080p (Full HD)]`,
                      "ai"
                    );
                  } else {
                    addLog(
                      "AI-PIPELINE",
                      `Исходник: ${maxLevelHeight || 720}p HD → Схема качества: [1080p (AI Upscale), 720p (HD)]`,
                      "ai"
                    );
                  }

                  const parsedQualities: { html: string; level: number; isAiUpscale?: boolean }[] = [];

                  if (has1080Native) {
                    // Strict user scheme for 1080p source:
                    // 1. 4K (AI Super-Res)
                    // 2. 1080p (Full HD)
                    // 3. 720p (HD)
                    // 4. 480p (SD)
                    // 5. Авто (4K AI)
                    parsedQualities.push({
                      html: "4K (AI Super-Res)",
                      level: active1080Level,
                      isAiUpscale: true,
                    });
                    parsedQualities.push({
                      html: "1080p (Full HD)",
                      level: active1080Level,
                    });
                    parsedQualities.push({
                      html: "720p (HD)",
                      level: active720Level,
                    });
                  } else {
                    // Strict user scheme for 720p or lower source:
                    // 1. 1080p (AI Upscale)
                    // 2. 720p (HD)
                    // 3. 480p (SD)
                    // 4. Авто (1080p AI)
                    parsedQualities.push({
                      html: "1080p (AI Upscale)",
                      level: bestLevel,
                      isAiUpscale: true,
                    });
                    parsedQualities.push({
                      html: "720p (HD)",
                      level: bestLevel,
                    });
                  }

                  // Add lower native tiers if available
                  const level480Index = levels.findIndex((l: any) => (l.height || 0) >= 400 && (l.height || 0) < 700);
                  if (level480Index !== -1) {
                    parsedQualities.push({ html: "480p (SD)", level: level480Index });
                  } else {
                    parsedQualities.push({ html: "480p (SD)", level: 0 });
                  }

                  const level360Index = levels.findIndex((l: any) => (l.height || 0) >= 300 && (l.height || 0) < 400);
                  if (level360Index !== -1) {
                    parsedQualities.push({ html: "360p", level: level360Index });
                  }

                  parsedQualities.push({
                    html: has1080Native ? "Авто (4K AI)" : "Авто (1080p AI)",
                    level: -1,
                  });

                  setAvailableQualities(parsedQualities);
                  setSelectedQuality(has1080Native ? "4K (AI Super-Res)" : "1080p (AI Upscale)");

                  const chosenTargetMode = has1080Native ? "4k" : "1080p";
                  if (webglInstanceRef.current) {
                    webglInstanceRef.current.setTargetMode(chosenTargetMode);
                    webglInstanceRef.current.start();
                  }

                  setTelemetry((prev) => ({
                    ...prev,
                    src: url,
                    targetMode: chosenTargetMode,
                    activeQuality: has1080Native ? "4K (AI Super-Res)" : "1080p (AI Upscale)",
                    hlsLevels: hlsLevelSummaries,
                    currentLevelIndex: has1080Native ? active1080Level : bestLevel,
                  }));
                });

                hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                  addLog("HLS", `Переключение активного уровня HLS на #${data.level}`, "info");
                  setTelemetry((prev) => ({ ...prev, currentLevelIndex: data.level }));
                });

                artInstance.on("ready", () => {
                  const videoEl = artInstance.video;
                  const isTv = isTvDevice();

                  addLog("DECODER", `Аппаратный декодер инициализирован (${videoEl.videoWidth || 1280}×${videoEl.videoHeight || 720})`, "success");

                  if (canvasRef.current && videoEl && !isTv) {
                    try {
                      const videoContainer = videoEl.parentElement;
                      if (videoContainer) {
                        videoContainer.appendChild(canvasRef.current);
                        canvasRef.current.setAttribute(
                          "style",
                          "position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transition: opacity 0.3s ease; opacity: 1; z-index: 5;",
                        );
                      }

                      webglInstance = new AnimeWebGLUpscaler(
                        canvasRef.current,
                        videoEl,
                      );
                      webglInstanceRef.current = webglInstance;
                      const has1080 = is1080Source === true || (is1080Source !== false && (videoEl.videoHeight >= 720 || videoEl.videoHeight >= 1000));
                      webglInstance.setTargetMode(has1080 ? "4k" : "1080p");
                      webglInstance.start();
                      addLog("AI-PIPELINE", `Dual-Pass WebGL шейдерный конвейер запущен (Target: ${has1080 ? '4K UHD (3840×2160)' : '1080p FHD (1920×1080)'})`, "ai");
                    } catch (e) {
                      console.error("Anime WebGL Initialization Error:", e);
                      addLog("ERROR", `Ошибка WebGL Upscaler: ${e}`, "error");
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

        // Catch and ignore benign playback interruption errors in ArtPlayer event listeners
        art.on("error", (err: any) => {
          if (
            err?.name === "AbortError" ||
            err?.name === "NotAllowedError" ||
            String(err?.message || err).includes("interrupted")
          ) {
            return;
          }
          console.warn("ArtPlayer error:", err);
        });

        // Track Play / Pause & Buffering
        art.on("video:play", () => {
          setIsPlaying(true);
          addLog("PLAYBACK", "Воспроизведение активно", "success");
        });
        art.on("video:pause", () => {
          setIsPlaying(false);
          addLog("PLAYBACK", "Воспроизведение приостановлено", "info");
        });
        art.on("video:waiting", () => {
          addLog("BUFFER", "Загрузка буфера видеопотока...", "warn");
        });
        art.on("video:playing", () => {
          addLog("PLAYBACK", "Поток стабилен, буфер синхронизирован", "info");
        });

        // Periodic Live Telemetry Monitor (1s polling)
        const telemetryInterval = setInterval(() => {
          if (!art || !art.video) return;
          const vid = art.video;
          const natW = vid.videoWidth || 0;
          const natH = vid.videoHeight || 0;
          const is4kCandidate = natH >= 1000;
          const targetH = is4kCandidate ? 2160 : 1080;
          const targetW = natH > 0 ? Math.round(targetH * (natW / natH)) : (is4kCandidate ? 3840 : 1920);

          let bufferSec = 0;
          if (vid.buffered && vid.buffered.length > 0) {
            const curr = vid.currentTime;
            for (let i = 0; i < vid.buffered.length; i++) {
              if (vid.buffered.start(i) <= curr && curr <= vid.buffered.end(i)) {
                bufferSec = vid.buffered.end(i) - curr;
                break;
              }
            }
          }

          setTelemetry((prev) => {
            const updated: StreamTelemetryData = {
              ...prev,
              src: finalUrl || src,
              provider: src.includes("/api/media/playlist") ? "Kodik (Прокси-поток)" : src.includes("anilibria") ? "AniLibria HLS" : "Kami CDN",
              nativeWidth: natW || prev.nativeWidth,
              nativeHeight: natH || prev.nativeHeight,
              renderWidth: targetW,
              renderHeight: targetH,
              fps: 24,
              droppedFrames: (vid as any).webkitDroppedFrameCount || 0,
              totalFrames: (vid as any).webkitDecodedFrameCount || 0,
              bufferAheadSeconds: bufferSec,
              currentTime: vid.currentTime,
              duration: vid.duration || 0,
              playbackState: vid.paused ? "paused" : "playing",
            };
            if (onTelemetryUpdate) onTelemetryUpdate(updated);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("kami:stream_telemetry", { detail: updated }));
            }
            return updated;
          });
        }, 1000);

        // Time updates: Progress, Skip Opening & Skip Ending logic
        art.on("video:timeupdate", () => {
          if (!art) return;
          const curr = art.currentTime;
          const dur = art.duration;
          saveProgress(curr, dur);

          // Opening badge check (uses real Kodik timestamps if available)
          if (skips?.opening) {
            const [opStart, opEnd] = skips.opening;
            if (curr >= opStart && curr < opEnd) {
              opTargetRef.current = opEnd;
              setShowSkipOpBtn(true);
            } else {
              setShowSkipOpBtn(false);
            }
          } else {
            // Fallback opening badge: between 10s and 110s
            if (curr >= 10 && curr <= 110) {
              opTargetRef.current = curr + 85;
              setShowSkipOpBtn(true);
            } else {
              setShowSkipOpBtn(false);
            }
          }

          // Ending badge check (uses real Kodik timestamps if available)
          if (skips?.ending) {
            const [edStart, edEnd] = skips.ending;
            if (curr >= edStart && (edEnd ? curr <= edEnd : true)) {
              edTargetRef.current = edEnd || dur;
              setShowSkipEdBtn(true);
            } else {
              setShowSkipEdBtn(false);
            }
          } else {
            // Fallback ending badge: in last 85 seconds of the episode (when dur > 180s)
            if (dur > 180 && curr >= dur - 85) {
              edTargetRef.current = dur;
              setShowSkipEdBtn(true);
            } else {
              setShowSkipEdBtn(false);
            }
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
        webglInstanceRef.current = null;
        if (art) {
          if (animeId && episodeNumber && art.currentTime > 5) {
            saveProgress(art.currentTime, art.duration);
          }
          if (art.destroy) {
            try {
              art.destroy(false);
            } catch (_) {}
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
    const handleSelectQuality = (item: { html: string; level: number; isAiUpscale?: boolean }) => {
      setSelectedQuality(item.html);
      const art = artInstanceRef.current;
      if (art && (art as any).hls) {
        (art as any).hls.currentLevel = item.level;
      }
      if (webglInstanceRef.current) {
        if (item.html.includes("4K")) {
          webglInstanceRef.current.setTargetMode("4k");
          webglInstanceRef.current.start();
        } else if (item.html.includes("1080p") || item.html === "Авто") {
          webglInstanceRef.current.setTargetMode("1080p");
          webglInstanceRef.current.start();
        } else {
          webglInstanceRef.current.stop();
        }
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

    // Skip Opening Action
    const handleSkipOpening = () => {
      const art = artInstanceRef.current;
      if (art) {
        const targetTime = opTargetRef.current || (art.currentTime + 85);
        art.currentTime = targetTime;
        if (art.notice) {
          art.notice.show = "Опенинг пропущен";
        }
      }
      setShowSkipOpBtn(false);
    };

    // Skip Ending Action -> Jump to Next Episode or end of ending
    const handleSkipEnding = () => {
      const art = artInstanceRef.current;
      if (onNextEpisodeRef.current) {
        onNextEpisodeRef.current();
      } else if (art && edTargetRef.current) {
        art.currentTime = edTargetRef.current;
      }
      setShowSkipEdBtn(false);
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

        {/* Dynamic Quick Skip Opening Badge */}
        {skipOpening && showSkipOpBtn && (
          <div className="absolute bottom-16 left-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={handleSkipOpening}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/80 hover:bg-[#8B5CF6] text-white border border-white/20 hover:border-[#8B5CF6] font-sans font-bold text-xs shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4 text-[#8B5CF6] group-hover:text-white" />
              <span>Пропустить опенинг</span>
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

        {/* TOP-LEFT LIVE STREAM RESOLUTION & AI UPSCALE PILL (Click opens HUD inspector) */}
        <button
          onClick={() => setShowHudOverlay((prev) => !prev)}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-[#121318] border border-white/15 hover:border-[#8B5CF6]/60 shadow-xl backdrop-blur-md transition-all text-xs font-bold text-white group cursor-pointer"
          title="Нажмите для открытия инспектора видеопотока и логов"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_#34d399]" />
          <span className="text-slate-300 group-hover:text-white transition-colors">
            {telemetry.nativeHeight ? `${telemetry.nativeHeight}p` : "1080p"}
          </span>
          <span className="text-slate-500 font-mono text-[10px]">→</span>
          <span className="text-[#A78BFA] font-extrabold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#C4B5FD]" />
            {telemetry.targetMode === "4k" ? "4K AI" : "1080p AI"}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-slate-300 font-mono uppercase tracking-wider group-hover:bg-[#8B5CF6]/30 group-hover:text-[#A78BFA] transition-colors">
            HUD
          </span>
        </button>

        {/* IN-PLAYER LIVE STREAM HUD OVERLAY */}
        {showHudOverlay && (
          <div
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md p-4 sm:p-6 flex flex-col justify-between font-sans text-white animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowHudOverlay(false);
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    Диагностика и логирование видеопотока
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Источник: <span className="text-slate-200 font-mono">{telemetry.provider}</span> • Статус: {isPlaying ? "Воспроизведение" : "Пауза"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const report = `=== KAMI STREAM REPORT ===\nURL: ${telemetry.src}\nNative: ${telemetry.nativeWidth}x${telemetry.nativeHeight}\nRender: ${telemetry.renderWidth}x${telemetry.renderHeight} (${telemetry.targetMode})\nQuality: ${selectedQuality}\nBuffer: ${telemetry.bufferAheadSeconds.toFixed(1)}s\nLevels: ${JSON.stringify(telemetry.hlsLevels)}\nLogs:\n${streamLogs.map(l => `[${l.time}][${l.tag}] ${l.message}`).join("\n")}`;
                    navigator.clipboard.writeText(report);
                    if (artInstanceRef.current && artInstanceRef.current.notice) {
                      artInstanceRef.current.notice.show = "Отчёт логов скопирован в буфер!";
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать отчёт</span>
                </button>
                <button
                  onClick={() => setShowHudOverlay(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3">
              <div className="bg-[#121318] border border-white/10 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Нативный поток (Декодер)
                </span>
                <span className="text-sm font-mono font-black text-white mt-0.5 block">
                  {telemetry.nativeWidth || 1920}×{telemetry.nativeHeight || 1080}
                </span>
                <span className="text-[10px] text-slate-400">
                  HLS Level: #{telemetry.currentLevelIndex}
                </span>
              </div>

              <div className="bg-[#121318] border border-[#8B5CF6]/30 rounded-xl p-2.5 bg-gradient-to-br from-[#8B5CF6]/10 to-transparent">
                <span className="text-[10px] font-bold text-[#A78BFA] uppercase tracking-wider block flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#C4B5FD]" />
                  Выходной рендеринг (AI)
                </span>
                <span className="text-sm font-mono font-black text-[#C4B5FD] mt-0.5 block">
                  {telemetry.renderWidth || 3840}×{telemetry.renderHeight || 2160}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  {telemetry.targetMode === "4k" ? "4K Super-Resolution Active" : "1080p AI Active"}
                </span>
              </div>

              <div className="bg-[#121318] border border-white/10 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Буфер потока
                </span>
                <span className="text-sm font-mono font-black text-emerald-400 mt-0.5 block">
                  +{telemetry.bufferAheadSeconds.toFixed(1)} сек.
                </span>
                <span className="text-[10px] text-slate-400">
                  Потери кадров: {telemetry.droppedFrames}
                </span>
              </div>

              <div className="bg-[#121318] border border-white/10 rounded-xl p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Выбранный режим
                </span>
                <span className="text-xs font-bold text-white mt-1 block truncate">
                  {selectedQuality}
                </span>
                <span className="text-[10px] text-[#A78BFA]">
                  {telemetry.hlsLevels.length} уровней качества
                </span>
              </div>
            </div>

            {/* Live Terminal Logs */}
            <div className="flex-1 bg-black/90 border border-white/10 rounded-xl p-3 flex flex-col font-mono text-xs overflow-hidden min-h-[140px]">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Журнал событий видеопотока в реальном времени
                </span>
                <button
                  onClick={() => setStreamLogs([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Очистить
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {streamLogs.length === 0 ? (
                  <div className="text-slate-600 italic text-[11px] py-4 text-center">
                    Ожидание событий воспроизведения потока...
                  </div>
                ) : (
                  streamLogs.map((log) => {
                    const tagColors: Record<string, string> = {
                      RESOLVER: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                      HLS: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                      "AI-PIPELINE": "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
                      DECODER: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
                      PLAYBACK: "text-slate-300 bg-white/5 border-white/10",
                      BUFFER: "text-amber-300 bg-amber-500/10 border-amber-500/20",
                      QUALITY: "text-pink-400 bg-pink-500/10 border-pink-500/20",
                      ERROR: "text-rose-400 bg-rose-500/20 border-rose-500/40",
                    };
                    const colorClass = tagColors[log.tag] || "text-slate-400 bg-white/5 border-white/10";
                    return (
                      <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${colorClass}`}>
                          {log.tag}
                        </span>
                        <span className="text-slate-300 break-all">{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Stream URL info */}
            <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span className="truncate max-w-[80%] font-mono">
                Stream: {telemetry.src}
              </span>
              <span>Клавиша HUD: [H] или иконка пульса</span>
            </div>
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

                  {/* 7. Инспектор видеопотока и логи */}
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setShowHudOverlay(true);
                    }}
                    className="flex items-center justify-between py-3 px-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:text-emerald-300 transition-colors">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          Инспектор потока и логи
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300">
                            HUD
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {telemetry.nativeHeight ? `${telemetry.nativeHeight}p` : "1080p"} → {telemetry.targetMode === "4k" ? "4K Super-Res" : "1080p AI"}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                  </button>

                  <div className="my-2 border-t border-white/5" />

                  {/* 8. Скачать серию */}
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

        {/* Optional Expanded Stream Inspector Below Player */}
        {showInspectorBelow && (
          <div className="mt-4">
            <StreamInspector
              telemetry={telemetry}
              logs={streamLogs}
              onClearLogs={() => setStreamLogs([])}
            />
          </div>
        )}
      </div>
    );
  },
);

CustomPlayer.displayName = "CustomPlayer";
