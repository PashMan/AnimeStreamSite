import React, { useEffect, useRef, forwardRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
  autoPlay?: boolean;
}

// Anime4K WebGL Shader Restoration and Upscalor Engine
class Anime4KWebGL {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private animId: number | null = null;
  public isActive = false;
  private mode: number = 0; // 0 = Anime4K, 1 = AMD CAS, 2 = LumaSharpen

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

    // Advanced, clean, multi-mode filter selection
    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec2 u_textureSize;
      uniform int u_mode;

      void main() {
        vec2 texel = vec2(1.0) / u_textureSize;
        vec2 tc = v_texCoord;

        if (u_mode == 0) {
          // --- ANIME4K BILATERAL & SOBEL EDGE THINNER + SHARP DETAILS ---
          vec4 c = texture2D(u_image, tc);
          vec4 t = texture2D(u_image, tc + vec2(0.0, -texel.y));
          vec4 b = texture2D(u_image, tc + vec2(0.0, texel.y));
          vec4 l = texture2D(u_image, tc + vec2(-texel.x, 0.0));
          vec4 r = texture2D(u_image, tc + vec2(texel.x, 0.0));

          vec4 tl = texture2D(u_image, tc + vec2(-texel.x, -texel.y));
          vec4 tr = texture2D(u_image, tc + vec2(texel.x, -texel.y));
          vec4 bl = texture2D(u_image, tc + vec2(-texel.x, texel.y));
          vec4 br = texture2D(u_image, tc + vec2(texel.x, texel.y));

          // Relative luminance coefficients (Rec. 709)
          vec3 lumaWeight = vec3(0.2126, 0.7152, 0.0722);
          float c_y = dot(c.rgb, lumaWeight);
          float t_y = dot(t.rgb, lumaWeight);
          float b_y = dot(b.rgb, lumaWeight);
          float l_y = dot(l.rgb, lumaWeight);
          float r_y = dot(r.rgb, lumaWeight);
          float tl_y = dot(tl.rgb, lumaWeight);
          float tr_y = dot(tr.rgb, lumaWeight);
          float bl_y = dot(bl.rgb, lumaWeight);
          float br_y = dot(br.rgb, lumaWeight);

          // 3x3 Sobel kernels for horizontal & vertical gradients
          float g_x = tl_y + 2.0 * l_y + bl_y - tr_y - 2.0 * r_y - br_y;
          float g_y = tl_y + 2.0 * t_y + tr_y - bl_y - 2.0 * b_y - br_y;
          float grad = sqrt(g_x * g_x + g_y * g_y);

          // Edge threshold limit for cartoon/anime boundary restoration
          if (grad > 0.040) {
            vec2 dir = vec2(g_x, g_y) / grad;
            
            // Re-sample slightly towards the edge normal to thin and smooth out pixel grids
            vec2 tc_sharp = tc - dir * texel * 0.65;
            vec4 c_sharp = texture2D(u_image, tc_sharp);

            // Compute high-frequency local detail for target edge contrast boosting
            vec4 blurred = (t + b + l + r) * 0.25;
            vec3 detail = c_sharp.rgb - blurred.rgb;
            vec3 edge_boosted = c_sharp.rgb + detail * 1.5;

            // Blend high-definition sharpened contours with standard color matching the local contrast
            gl_FragColor = vec4(mix(c.rgb, clamp(edge_boosted, 0.0, 1.0), clamp(grad * 2.5, 0.0, 0.95)), c.a);
          } else {
            // Apply lightweight bilateral-like range filter to smooth skin, sky, and dark/flat backdrops
            float w_total = 1.0;
            vec4 accum = c;
            float sigma_color = 0.12;

            float d_t = distance(t.rgb, c.rgb);
            float w_t = max(0.0, 1.0 - (d_t / sigma_color));
            w_t = w_t * w_t;
            accum += t * w_t;
            w_total += w_t;

            float d_b = distance(b.rgb, c.rgb);
            float w_b = max(0.0, 1.0 - (d_b / sigma_color));
            w_b = w_b * w_b;
            accum += b * w_b;
            w_total += w_b;

            float d_l = distance(l.rgb, c.rgb);
            float w_l = max(0.0, 1.0 - (d_l / sigma_color));
            w_l = w_l * w_l;
            accum += l * w_l;
            w_total += w_l;

            float d_r = distance(r.rgb, c.rgb);
            float w_r = max(0.0, 1.0 - (d_r / sigma_color));
            w_r = w_r * w_r;
            accum += r * w_r;
            w_total += w_r;

            vec3 smoothed = accum.rgb / w_total;
            gl_FragColor = vec4(smoothed, c.a);
          }
        }
        else if (u_mode == 1) {
          // --- AMD CONTRAST ADAPTIVE SHARPENING (CAS) ---
          vec3 c = texture2D(u_image, tc).rgb;
          vec3 t = texture2D(u_image, tc + vec2(0.0, -texel.y)).rgb;
          vec3 b = texture2D(u_image, tc + vec2(0.0, texel.y)).rgb;
          vec3 l = texture2D(u_image, tc + vec2(-texel.x, 0.0)).rgb;
          vec3 r = texture2D(u_image, tc + vec2(texel.x, 0.0)).rgb;

          vec3 tl = texture2D(u_image, tc + vec2(-texel.x, -texel.y)).rgb;
          vec3 tr = texture2D(u_image, tc + vec2(texel.x, -texel.y)).rgb;
          vec3 bl = texture2D(u_image, tc + vec2(-texel.x, texel.y)).rgb;
          vec3 br = texture2D(u_image, tc + vec2(texel.x, texel.y)).rgb;

          vec3 min_rgb = min(c, min(min(t, b), min(l, r)));
          vec3 max_rgb = max(c, max(max(t, b), max(l, r)));

          min_rgb = min(min_rgb, min(min(tl, tr), min(bl, br)));
          max_rgb = max(max_rgb, max(max(tl, tr), max(bl, br)));

          float peak = -3.0; // Sharpness peak limit scale
          vec3 w = max_rgb - min_rgb;
          vec3 min_l = min_rgb;
          vec3 max_l = 1.0 - max_rgb;
          vec3 weight = sqrt(min(min_l, max_l) / (w + 0.0001));
          vec3 clp = weight * (1.0 / peak);

          vec3 final_rgb = (t * clp + b * clp + l * clp + r * clp + c) / (1.0 + 4.0 * clp);
          gl_FragColor = vec4(clamp(final_rgb, 0.0, 1.0), 1.0);
        }
        else if (u_mode == 2) {
          // --- LUMASHARPEN (Luma high-pass filter) ---
          vec4 color = texture2D(u_image, tc);
          vec3 lumaWeight = vec3(0.2126, 0.7152, 0.0722);

          float c_y = dot(color.rgb, lumaWeight);
          float t_y = dot(texture2D(u_image, tc + vec2(0.0, -texel.y)).rgb, lumaWeight);
          float b_y = dot(texture2D(u_image, tc + vec2(0.0, texel.y)).rgb, lumaWeight);
          float l_y = dot(texture2D(u_image, tc + vec2(-texel.x, 0.0)).rgb, lumaWeight);
          float r_y = dot(texture2D(u_image, tc + vec2(texel.x, 0.0)).rgb, lumaWeight);

          float blur = (t_y + b_y + l_y + r_y) * 0.25;
          float diff = c_y - blur;

          float sharp_strength = 1.6;
          float sharp_clamp = 0.04;
          float diff_clamped = clamp(diff * sharp_strength, -sharp_clamp, sharp_clamp);

          vec3 final_color = color.rgb + vec3(diff_clamped);
          gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        }
        else {
          gl_FragColor = texture2D(u_image, tc);
        }
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

  public setMode(mode: number) {
    this.mode = mode;
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
    // Высокопроизводительный апскейл до 2K (2560x1440), который мы позиционируем как 4K AI.
    // Позволяет получить ультра-четкую картинку без перегрузки GPU/памяти на средних девайсах.
    const width = this.video.videoWidth || 1280;
    const height = this.video.videoHeight || 720;
    const aspectRatio = width / height;
    
    // Целимся ровно в 2K (высота 1440) сохраняя пропорции
    let targetHeight = 1440;
    let targetWidth = Math.round(targetHeight * aspectRatio);

    if (targetWidth > 2560) {
      targetWidth = 2560;
      targetHeight = Math.round(2560 / aspectRatio);
    }
    
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

    const uMode = gl.getUniformLocation(this.program, "u_mode");
    gl.uniform1i(uMode, this.mode);

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
                if (!uri.startsWith('http')) return `URI="${baseUrl}${uri}"`;
                return match;
              });
            }
            if (line && !line.startsWith('#') && !line.startsWith('http')) {
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
                  return height ? height + 'p' : 'Unknown';
                };

                const levels = data.levels || hls.levels;
                const standardQualities = levels.map((l: any, index: number) => ({
                  html: getQualityName(l),
                  level: index,
                  isUpscale: false,
                  default: index === levels.length - 1
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

                // Show highest qualities first
                qualitiesList.reverse();

                if (qualitiesList.length > 0) {
                  artInstance.setting.add({
                    name: 'quality',
                    html: 'Качество',
                    width: 220,
                    tooltip: qualitiesList[0].html,
                    selector: qualitiesList,
                    onSelect: function (item) {
                      hls.nextLevel = item.level;
                      
                      const isTargetUpscale = item.html.includes('1080') || item.html.includes('4K');
                      if (isTargetUpscale) {
                        if (webglInstance) {
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
                const playbackRateSetting = (artInstance.setting as any).get ? (artInstance.setting as any).get('playbackRate') : (artInstance.setting as any).find('playbackRate');
                if (playbackRateSetting) {
                  playbackRateSetting.html = 'Скорость';
                }
                const aspectRatioSetting = (artInstance.setting as any).get ? (artInstance.setting as any).get('aspectRatio') : (artInstance.setting as any).find('aspectRatio');
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
                    webglInstance.stop(); // Safe default
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
