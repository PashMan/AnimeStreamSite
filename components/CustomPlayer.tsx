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
            const hls = new Hls({
              maxMaxBufferLength: 30,
              maxBufferSize: 60 * 1000 * 1000,
            });
            artInstance.hls = hls;
            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
              hls.loadSource(url);
            });

            hls.on(Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                console.error('HLS.js fatal error:', data.type, data.details);
                // Removed aggressive auto-recovery to prevent ERR_HTTP2_PROTOCOL_ERROR infinite loops
              }
            });

            let isQualityAdded = false;
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
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

              const qualities = hls.levels.map((l, index) => ({
                html: getQualityName(l),
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
