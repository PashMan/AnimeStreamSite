import React, { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';

interface CustomPlyrPlayerProps {
  src: string;
}

export const CustomPlyrPlayer: React.FC<CustomPlyrPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const defaultOptions: Plyr.Options = {
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'duration',
        'mute', 'volume', 'settings', 'fullscreen'
      ],
      settings: ['quality', 'speed'],
      i18n: {
        quality: 'Качество',
        speed: 'Скорость',
        normal: 'Обычная',
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const availableQualities = hls.levels.map((l) => l.height);
        
        defaultOptions.quality = {
          default: availableQualities[availableQualities.length - 1],
          options: availableQualities.sort((a, b) => b - a),
          forced: true,
          onChange: (e: number) => {
            hls.levels.forEach((level, levelIndex) => {
              if (level.height === e) {
                hls.currentLevel = levelIndex;
              }
            });
          },
        };

        playerRef.current = new Plyr(video, defaultOptions);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      playerRef.current = new Plyr(video, defaultOptions);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [src]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden custom-plyr-wrapper">
      <video ref={videoRef} className="w-full h-full" crossOrigin="anonymous" playsInline></video>
    </div>
  );
};
