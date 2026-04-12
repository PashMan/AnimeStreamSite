import React from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';

interface CustomR2PlayerProps {
  src: string;
}

export const CustomR2Player: React.FC<CustomR2PlayerProps> = ({ src }) => {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <MediaPlayer 
        title="Твое имя (4K)" 
        src={src} 
        crossOrigin="anonymous"
        className="w-full h-full"
      >
        <MediaProvider />
        <DefaultVideoLayout 
          icons={defaultLayoutIcons} 
          colorScheme="dark"
        />
      </MediaPlayer>
    </div>
  );
};
