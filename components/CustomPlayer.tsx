import React, { useEffect, useRef, forwardRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
  autoPlay?: boolean;
}

// WebGL pristine-sampling upscaler
class Anime4KWebGL {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  public isActive = false;
  private targetHeight: number = 1440; // Default: 2K (2560x1440)

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.canvas = canvas;
    this.video = video;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      depth: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (!gl) {
      throw new Error("WebGL is not supported in this environment");
    }
    this.gl = gl;

    // Direct clip vertex shader
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // High-Fidelity 16-sample Bicubic Catmull-Rom upscaling shader
    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;

      vec4 bicubicSample(sampler2D image, vec2 uv, vec2 texSize) {
        vec2 texel = vec2(1.0) / texSize;
        vec2 st = uv * texSize - 0.5;
        vec2 i_st = floor(st);
        vec2 f_st = fract(st);

        // Catmull-Rom cubic weights
        vec2 w0 = f_st * (-0.5 + f_st * (1.0 - 0.5 * f_st));
        vec2 w1 = 1.0 + f_st * f_st * (-2.5 + 1.5 * f_st);
        vec2 w2 = f_st * (0.5 + f_st * (2.0 - 1.5 * f_st));
        vec2 w3 = f_st * f_st * (-0.5 + 0.5 * f_st);

        // Grid coordinates of the 4x4 texel block
        vec2 p0 = (i_st - vec2(0.5)) * texel;
        vec2 p1 = (i_st + vec2(0.5)) * texel;
        vec2 p2 = (i_st + vec2(1.5)) * texel;
        vec2 p3 = (i_st + vec2(2.5)) * texel;

        vec4 col = vec4(0.0);

        // Row 0
        col += texture2D(image, vec2(p0.x, p0.y)) * w0.x * w0.y;
        col += texture2D(image, vec2(p1.x, p0.y)) * w1.x * w0.y;
        col += texture2D(image, vec2(p2.x, p0.y)) * w2.x * w0.y;
        col += texture2D(image, vec2(p3.x, p0.y)) * w3.x * w0.y;

        // Row 1
        col += texture2D(image, vec2(p0.x, p1.y)) * w0.x * w1.y;
        col += texture2D(image, vec2(p1.x, p1.y)) * w1.x * w1.y;
        col += texture2D(image, vec2(p2.x, p1.y)) * w2.x * w1.y;
        col += texture2D(image, vec2(p3.x, p1.y)) * w3.x * w1.y;

        // Row 2
        col += texture2D(image, vec2(p0.x, p2.y)) * w0.x * w2.y;
        col += texture2D(image, vec2(p1.x, p2.y)) * w1.x * w2.y;
        col += texture2D(image, vec2(p2.x, p2.y)) * w2.x * w2.y;
        col += texture2D(image, vec2(p3.x, p2.y)) * w3.x * w2.y;

        // Row 3
        col += texture2D(image, vec2(p0.x, p3.y)) * w0.x * w3.y;
        col += texture2D(image, vec2(p1.x, p3.y)) * w1.x * w3.y;
        col += texture2D(image, vec2(p2.x, p3.y)) * w2.x * w3.y;
        col += texture2D(image, vec2(p3.x, p3.y)) * w3.x * w3.y;

        return col;
      }

      void main() {
        vec2 texel = vec2(1.0) / u_textureSize;
        vec2 tc = v_texCoord;

        // Pristine Catmull-Rom upscaled center pixel
        vec4 c = bicubicSample(u_image, tc, u_textureSize);

        // Hardware-accelerated bilinear samples for neighboring pixels
        vec4 t = texture2D(u_image, tc + vec2(0.0, -texel.y));
        vec4 b = texture2D(u_image, tc + vec2(0.0, texel.y));
        vec4 l = texture2D(u_image, tc + vec2(-texel.x, 0.0));
        vec4 r = texture2D(u_image, tc + vec2(texel.x, 0.0));

        vec4 tl = texture2D(u_image, tc + vec2(-texel.x, -texel.y));
        vec4 tr = texture2D(u_image, tc + vec2(texel.x, -texel.y));
        vec4 bl = texture2D(u_image, tc + vec2(-texel.x, texel.y));
        vec4 br = texture2D(u_image, tc + vec2(texel.x, texel.y));

        // Get relative luma values for Sobel edge detection
        vec3 lumaWeight = vec3(0.299, 0.587, 0.114);
        float c_y = dot(c.rgb, lumaWeight);
        float t_y = dot(t.rgb, lumaWeight);
        float b_y = dot(b.rgb, lumaWeight);
        float l_y = dot(l.rgb, lumaWeight);
        float r_y = dot(r.rgb, lumaWeight);
        float tl_y = dot(tl.rgb, lumaWeight);
        float tr_y = dot(tr.rgb, lumaWeight);
        float bl_y = dot(bl.rgb, lumaWeight);
        float br_y = dot(br.rgb, lumaWeight);

        // Compute Sobel gradients
        float g_x = tl_y + 2.0 * l_y + bl_y - tr_y - 2.0 * r_y - br_y;
        float g_y = tl_y + 2.0 * t_y + tr_y - bl_y - 2.0 * b_y - br_y;
        float grad = sqrt(g_x * g_x + g_y * g_y);

        // Halo-Free Limits: compute min and max values in the 3x3 neighborhood
        vec3 min_color = min(c.rgb, min(min(t.rgb, b.rgb), min(l.rgb, r.rgb)));
        vec3 max_color = max(c.rgb, max(max(t.rgb, b.rgb), max(l.rgb, r.rgb)));
        min_color = min(min_color, min(min(tl.rgb, tr.rgb), min(bl.rgb, br.rgb)));
        max_color = max(max_color, max(max(tl.rgb, tr.rgb), max(bl.rgb, br.rgb)));

        // Adaptive High-Pass Sharpening
        vec3 blurred = (t.rgb + b.rgb + l.rgb + r.rgb) * 0.25;
        vec3 sharp_color = c.rgb + (c.rgb - blurred) * 1.5;

        // Strictly clamp to local min/max to completely prevent white/black halos and overexposure
        vec3 final_sharpened = clamp(sharp_color, min_color, max_color);

        // Outline contour detection and thinning/sharpening
        vec3 final_color = final_sharpened;
        if (grad > 0.04) {
          vec2 dir = vec2(g_x, g_y) / grad;
          // Sample offset along gradient direction for edge reconstruction
          vec2 tc_shifted = tc - dir * texel * 0.50;
          vec4 shifted_sample = bicubicSample(u_image, tc_shifted, u_textureSize);
          
          // Clamp and blend to preserve natural contours and skin tones
          vec3 thinned_color = clamp(shifted_sample.rgb, min_color, max_color);
          float edge_mix = clamp(grad * 3.0, 0.0, 0.90);
          final_color = mix(final_sharpened, thinned_color, edge_mix);
        }

        gl_FragColor = vec4(final_color, c.a);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    const prg = gl.createProgram();
    if (!prg) throw new Error("Program instantiation failed");
    gl.attachShader(prg, vs);
    gl.attachShader(prg, fs);
    gl.linkProgram(prg);

    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
      throw new Error(`Shader linking compilation failure: ${gl.getProgramInfoLog(prg)}`);
    }
    this.program = prg;

    // Geometry buffer definition
    const geomBuffer = gl.createBuffer();
    if (!geomBuffer) throw new Error("WebGL buffer creation error");
    this.buffer = geomBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, geomBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

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

  public setTargetHeight(h: number) {
    this.targetHeight = h;
    if (this.isActive) {
      this.resize();
    }
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
    this.canvas.style.opacity = '0';
    this.video.style.opacity = '1';
  };

  private onWaiting = () => {
    this.canvas.style.opacity = '0';
    this.video.style.opacity = '1';
  };

  private onPlaying = () => {
    if (this.isActive) {
      this.canvas.style.opacity = '1';
      this.video.style.opacity = '0';
    }
  };

  private onSeeked = () => {
    if (this.isActive && this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
      if (!this.video.seeking) {
        this.canvas.style.opacity = '1';
        this.video.style.opacity = '0';
      }
    }
  };

  public resize() {
    const width = this.video.videoWidth || 1280;
    const height = this.video.videoHeight || 720;
    const aspectRatio = width / height;
    
    let targetHeight = this.targetHeight;
    let targetWidth = Math.round(targetHeight * aspectRatio);
    
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    this.gl.viewport(0, 0, targetWidth, targetHeight);
  }

  public start() {
    if (this.isActive) return;
    this.isActive = true;
    this.resize();
    
    this.video.addEventListener('seeking', this.onSeeking);
    this.video.addEventListener('waiting', this.onWaiting);
    this.video.addEventListener('playing', this.onPlaying);
    this.video.addEventListener('seeked', this.onSeeked);

    if (this.video.readyState >= this.video.HAVE_CURRENT_DATA && !this.video.seeking) {
      this.canvas.style.opacity = '1';
      this.video.style.opacity = '0';
    } else {
      this.canvas.style.opacity = '0';
      this.video.style.opacity = '1';
    }
    
    this.loop();
  }

  public stop() {
    this.isActive = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    
    this.video.removeEventListener('seeking', this.onSeeking);
    this.video.removeEventListener('waiting', this.onWaiting);
    this.video.removeEventListener('playing', this.onPlaying);
    this.video.removeEventListener('seeked', this.onSeeked);
    
    this.canvas.style.opacity = '0';
    this.video.style.opacity = '1';
  }

  private loop = () => {
    if (!this.isActive) return;
    this.render();
    this.animId = requestAnimationFrame(this.loop);
  };

  private render() {
    if (this.video.readyState < this.video.HAVE_CURRENT_DATA) return;
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);

    gl.useProgram(this.program);

    const pos = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uImg = gl.getUniformLocation(this.program, "u_image");
    gl.uniform1i(uImg, 0);

    const uSize = gl.getUniformLocation(this.program, "u_textureSize");
    gl.uniform2f(uSize, this.video.videoWidth || 1280, this.video.videoHeight || 720);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public destroy() {
    this.stop();
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
  }
}

export const CustomPlayer = forwardRef<HTMLVideoElement, CustomPlayerProps>(({ src, maxAudioTracks, audioTrackNames, autoPlay }, ref) => {
  const artRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!artRef.current) return;

    let art: Artplayer | null = null;
    let blobUrl: string | null = null;
    let isCancelled = false;
    let webglInstance: Anime4KWebGL | null = null;
    let selectedQualityHtml = '4K';

    const initPlayer = async () => {
      let finalUrl = src;

      // Rewrite manifest in case of m3u8 path mappings
      if (maxAudioTracks && src.endsWith('.m3u8')) {
        try {
          const res = await fetch(src);
          const text = await res.text();
          const baseUrl = src.substring(0, src.lastIndexOf('/') + 1);
          
          const lines = text.replace(/\r/g, '').split('\n');
          let audioCount = 0;
          const newLines = lines.map(line => {
            if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
              audioCount++;
              if (audioCount > maxAudioTracks) return null;
            }
            if (line.includes('URI="')) {
              return line.replace(/URI="([^"]+)"/, (match, uri) => {
                if (!uri.startsWith('http') && !uri.startsWith('/')) return `URI="${baseUrl}${uri}"`;
                return match;
              });
            }
            if (line && !line.startsWith('#') && !line.startsWith('http') && !line.startsWith('/')) {
              return baseUrl + line;
            }
            return line;
          }).filter(l => l !== null);
          
          const blob = new Blob([newLines.join('\n')], { type: 'application/vnd.apple.mpegurl' });
          blobUrl = URL.createObjectURL(blob);
          finalUrl = blobUrl;
        } catch (e) {
          console.error('Failed to rewrite manifest', e);
        }
      }

      if (isCancelled || !artRef.current) return;

      art = new Artplayer({
        container: artRef.current,
        url: finalUrl,
        type: src.includes('.m3u8') || src.includes('/playlist') ? 'm3u8' : undefined,
        theme: '#E11D48',
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
        lang: 'ru',
        i18n: {
          'ru': {
            'Play Speed': 'Скорость воспроизведения',
            'Aspect Ratio': 'Соотношение сторон',
            'Default': 'По умолчанию',
            'Normal': 'Обычная',
            'Settings': 'Настройки',
            'Play': 'Запуск',
            'Pause': 'Пауза',
            'Volume': 'Громкость',
            'Mute': 'Заглушить',
            'Screenshot': 'Скриншот',
            'Fullscreen': 'Во весь экран',
            'Exit Fullscreen': 'Выйти из полноэкранного режима',
            'Web Fullscreen': 'В окне браузера',
            'Exit Web Fullscreen': 'Выйти из режима окна',
            'PIP Mode': 'Картинка в картинке',
            'Exit PIP Mode': 'Закрыть картинку в картинке',
            'Flip': 'Поворот',
            'Video Info': 'Служебная информация',
          }
        } as any,
        layers: [
          {
            name: 'play-pause-layer',
            html: '',
            style: { display: 'none' },
          },
        ],
        customType: {
          m3u8: function (video, url, artInstance) {
            if (Hls.isSupported()) {
              if ((artInstance as any).hls) (artInstance as any).hls.destroy();
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
                  console.error('HLS.js fatal error:', data.type, data.details);
                  if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR || (data.details && data.details.toLowerCase().includes('parsing'))) {
                    console.warn('[HLS DIAGNOSTIC] manifestParsingError detected. Attempting to fetch raw manifest from:', url);
                    fetch(url)
                      .then(r => r.text())
                      .then(txt => {
                        console.error('[HLS DIAGNOSTIC] RAW MANIFEST BODY:');
                        console.error(txt);
                      })
                      .catch(err => {
                        console.error('[HLS DIAGNOSTIC] Failed to fetch raw manifest text:', err);
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
                  if (width >= 3800 || height >= 1500) return '4K';
                  if (width >= 1900 || height >= 800) return '1080p';
                  if (width >= 1200 || height >= 500) return '720p';
                  if (width >= 800 || height >= 400) return '480p';
                  if (width >= 600 || height >= 300) return '360p';
                  return height ? height + 'p' : 'Неизвестно';
                };

                const levels = data.levels || hls.levels;
                const standardQualities = levels.map((l: any, index: number) => ({
                  html: getQualityName(l),
                  level: index,
                  isUpscale: false,
                  default: false
                }));

                const maxLevelIdx = levels.length - 1;
                const qualitiesList = [...standardQualities];

                const hasNative1080 = standardQualities.some(q => q.html.includes('1080'));
                const hasNative4K = standardQualities.some(q => q.html.includes('4K'));

                if (!hasNative1080) {
                  qualitiesList.push({
                    html: '1080p',
                    level: maxLevelIdx,
                    isUpscale: true,
                    default: false
                  });
                }

                if (!hasNative4K) {
                  qualitiesList.push({
                    html: '4K',
                    level: maxLevelIdx,
                    isUpscale: true,
                    default: false
                  });
                }

                // Determine the upscale or best quality to set as initial default
                const defaultItem = qualitiesList.find(q => q.html === '4K') || 
                                    qualitiesList.find(q => q.html === '1080p') || 
                                    qualitiesList[qualitiesList.length - 1]; // Highest standard available

                if (defaultItem) {
                  defaultItem.default = true;
                  selectedQualityHtml = defaultItem.html;
                }

                // Show highest qualities first
                qualitiesList.reverse();

                if (qualitiesList.length > 0) {
                  const defaultItemInReversed = qualitiesList.find(q => q.default) || qualitiesList[0];
                  artInstance.setting.add({
                    name: 'quality',
                    html: 'Качество',
                    width: 220,
                    tooltip: defaultItemInReversed.html,
                    selector: qualitiesList,
                    onSelect: function (item) {
                      hls.nextLevel = item.level;
                      selectedQualityHtml = item.html;
                      
                      const isTargetUpscale = item.html.includes('1080') || item.html.includes('4K');
                      if (isTargetUpscale) {
                        if (webglInstance) {
                          if (item.html.includes('1080')) {
                            webglInstance.setTargetHeight(1080);
                          } else {
                            webglInstance.setTargetHeight(1440); // 2K Real Quality
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
                  if (webglInstance && (selectedQualityHtml.includes('1080') || selectedQualityHtml.includes('4K'))) {
                    if (selectedQualityHtml.includes('1080')) {
                      webglInstance.setTargetHeight(1080);
                    } else {
                      webglInstance.setTargetHeight(1440);
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
                  html: (audioTrackNames && audioTrackNames[index]) ? audioTrackNames[index] : (t.name || (t as any).language || `Озвучка ${index + 1}`),
                  trackId: index,
                  default: index === hls.audioTrack
                }));

                if (tracks.length > 1) {
                  artInstance.setting.add({
                    name: 'audio',
                    html: 'Озвучка',
                    width: 250,
                    tooltip: tracks.find(t => t.default)?.html || tracks[0].html,
                    selector: tracks,
                    onSelect: function (item) {
                      hls.audioTrack = item.trackId;
                      if (artInstance && artInstance.video) {
                        artInstance.video.dispatchEvent(new CustomEvent('audiotrackchange', { detail: item.trackId }));
                      }
                      return item.html;
                    },
                  });
                }
              });

              artInstance.on('ready', () => {
                const findSetting = (names: string[]) => {
                  for (const n of names) {
                    const found = (artInstance.setting as any).get?.(n) || 
                                  (artInstance.setting as any).find?.(n) ||
                                  (artInstance.setting as any).get?.(n.toLowerCase());
                    if (found) return found;
                  }
                  return null;
                };

                const playbackRateSetting = findSetting(['playbackRate', 'playback-rate', 'rate']);
                if (playbackRateSetting) {
                  playbackRateSetting.html = 'Скорость';
                }
                const aspectRatioSetting = findSetting(['aspectRatio', 'aspect-ratio', 'ratio']);
                if (aspectRatioSetting) {
                  aspectRatioSetting.html = 'Соотношение сторон';
                }

                // Link WebGL Anime4K engine to the actual player video element
                const videoEl = artInstance.video;
                const isNative4K = src.toLowerCase().includes('proxy-4k') || 
                                   src.toLowerCase().includes('kamianime') || 
                                   src.toLowerCase().includes('suzume') || 
                                   src.toLowerCase().includes('weathering') || 
                                   src.toLowerCase().includes('garden_of_words') || 
                                                  src.toLowerCase().includes('kimi-no-na-wa');

                 if (canvasRef.current && videoEl && !isNative4K) {
                  try {
                    const videoContainer = videoEl.parentElement;
                    if (videoContainer) {
                      videoContainer.appendChild(canvasRef.current);
                      canvasRef.current.setAttribute('style', 'position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transition: opacity 0.3s ease; opacity: 0; z-index: 5;');
                    }

                    webglInstance = new Anime4KWebGL(canvasRef.current, videoEl);
                    if (selectedQualityHtml && (selectedQualityHtml.includes('1080') || selectedQualityHtml.includes('4K'))) {
                      if (selectedQualityHtml.includes('1080')) {
                        webglInstance.setTargetHeight(1080);
                      } else {
                        webglInstance.setTargetHeight(1440);
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

              artInstance.on('destroy', () => hls.destroy());
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            }
          }
        }
      });

      if (typeof ref === 'function') {
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
      <div ref={artRef} className="w-full h-full" />
      <canvas
        ref={canvasRef}
        style={{ pointerEvents: 'none', transition: 'opacity 0.3s ease' }}
        className="absolute inset-0 w-full h-full object-contain opacity-0 z-10"
      />
    </div>
  );
});

CustomPlayer.displayName = 'CustomPlayer';
