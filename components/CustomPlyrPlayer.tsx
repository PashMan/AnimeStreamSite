import React, { useEffect, useRef, useState, forwardRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';

interface CustomPlyrPlayerProps {
  src: string;
}

interface AudioTrack {
  id: number;
  name: string;
}

export const CustomPlyrPlayer = forwardRef<HTMLVideoElement, CustomPlyrPlayerProps>(({ src }, ref) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<number>(0);

  const setVideoRef = (element: HTMLVideoElement) => {
    internalVideoRef.current = element;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  useEffect(() => {
    const video = internalVideoRef.current;
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
        
        // Handle audio tracks
        if (hls.audioTracks && hls.audioTracks.length > 1) {
          const tracks = hls.audioTracks.map((track, index) => ({
            id: index,
            name: track.name || `Озвучка ${index + 1}`
          }));
          setAudioTracks(tracks);
          setCurrentTrack(hls.audioTrack);
        }

        defaultOptions.quality = {
          default: availableQualities[availableQualities.length - 1],
          options: availableQualities.sort((a, b) => b - a),
          forced: true,
          onChange: (e: number) => {
            hls.levels.forEach((level, levelIndex) => {
              if (level.height === e) {
                // Use nextLevel instead of currentLevel for seamless switching without freezing
                hls.nextLevel = levelIndex;
              }
            });
          },
        };

        playerRef.current = new Plyr(video, defaultOptions);
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        setCurrentTrack(data.id);
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

  const handleTrackChange = (trackId: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
      setCurrentTrack(trackId);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {audioTracks.length > 1 && (
        <div className="flex flex-wrap gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-sm flex items-center px-2">Озвучка:</span>
          {audioTracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleTrackChange(track.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentTrack === track.id 
                  ? 'bg-primary text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {track.name}
            </button>
          ))}
        </div>
      )}
      <div className="w-full rounded-xl overflow-hidden custom-plyr-wrapper bg-black aspect-video">
        <video ref={setVideoRef} className="w-full h-full" crossOrigin="anonymous" playsInline></video>
      </div>
    </div>
  );
});
