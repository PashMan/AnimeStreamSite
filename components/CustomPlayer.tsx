import React, { useEffect, useRef, forwardRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface CustomPlayerProps {
  src: string;
  maxAudioTracks?: number;
  audioTrackNames?: string[];
}

export const CustomPlayer = forwardRef<HTMLVideoElement, CustomPlayerProps>(({ src, maxAudioTracks, audioTrackNames }, ref) => {
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
      autoMini: false,
      screenshot: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      lang: 'ru',
      // Disable layer messages for play/pause/seek
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
            if (artInstance.hls) artInstance.hls.destroy();
            const hls = new Hls();
            artInstance.hls = hls;
            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
              hls.loadSource(url);
            });

            hls.on(Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.error('fatal network error encountered, try to recover');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.error('fatal media error encountered, try to recover');
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            });

            let isQualityAdded = false;
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (isQualityAdded) return;
              isQualityAdded = true;
              
              const getQualityName = (height: number) => {
                if (height >= 2000) return '4K';
                if (height >= 1000) return '1080p';
                if (height >= 700) return '720p';
                if (height >= 480) return '480p';
                if (height >= 360) return '360p';
                return height + 'p';
              };

              const qualities = hls.levels.map((l, index) => ({
                html: getQualityName(l.height),
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

              let tracks = data.audioTracks.map((t, index) => ({
                html: (audioTrackNames && audioTrackNames[index]) ? audioTrackNames[index] : (t.name || t.language || `Озвучка ${index + 1}`),
                trackId: index,
                default: index === hls.audioTrack
              }));

              if (maxAudioTracks && tracks.length > maxAudioTracks) {
                tracks = tracks.slice(0, maxAudioTracks);
              }

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

            // Translate settings
            artInstance.on('ready', () => {
              const playbackRateSetting = artInstance.setting.get('playbackRate');
              if (playbackRateSetting) {
                playbackRateSetting.html = 'Скорость';
              }
              const aspectRatioSetting = artInstance.setting.get('aspectRatio');
              if (aspectRatioSetting) {
                aspectRatioSetting.html = 'Соотношение сторон';
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
  }, [src, ref, maxAudioTracks, audioTrackNames]);

  return <div ref={artRef} className="w-full aspect-video rounded-xl overflow-hidden bg-black" />;
});
