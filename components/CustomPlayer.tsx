import React, { useEffect, useRef, forwardRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface CustomPlayerProps {
  src: string;
}

export const CustomPlayer = forwardRef<HTMLVideoElement, CustomPlayerProps>(({ src }, ref) => {
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!artRef.current) return;

    const art = new Artplayer({
      container: artRef.current,
      url: src,
      theme: '#E11D48',
      volume: 0.7,
      autoplay: false,
      pip: true,
      autoSize: true,
      autoMini: false, // Disabled to prevent auto-PIP
      screenshot: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      lang: 'ru',
      customType: {
        m3u8: function (video, url, artInstance) {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);

            let isQualityAdded = false;
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (isQualityAdded) return;
              isQualityAdded = true;
              
              const qualities = hls.levels.map((l, index) => ({
                html: l.height + 'p',
                level: index,
                default: index === hls.levels.length - 1
              })).reverse();

              if (qualities.length > 0) {
                artInstance.setting.add({
                  name: 'quality',
                  html: 'Качество',
                  width: 200,
                  tooltip: qualities[0].html,
                  selector: qualities,
                  onSelect: function (item) {
                    hls.nextLevel = item.level;
                    return item.html;
                  },
                });
              }
            });

            let isAudioAdded = false;
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
              if (isAudioAdded) return;
              isAudioAdded = true;

              const tracks = data.audioTracks.map((t, index) => ({
                html: t.name || t.language || `Озвучка ${index + 1}`,
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
                    return item.html;
                  },
                });
              }
            });

            // Translate playback rate setting
            artInstance.on('ready', () => {
              const playbackRateSetting = artInstance.setting.get('playbackRate');
              if (playbackRateSetting) {
                playbackRateSetting.html = 'Скорость';
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
      ref(art.video);
    } else if (ref) {
      ref.current = art.video;
    }

    return () => {
      if (art && art.destroy) {
        art.destroy(false);
      }
    };
  }, [src, ref]);

  return <div ref={artRef} className="w-full aspect-video rounded-xl overflow-hidden bg-black" />;
});
