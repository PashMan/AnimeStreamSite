import React, { useState, useEffect, ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchAnilistImage } from '../services/anilist';
import { FALLBACK_IMAGE } from '../constants';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  priority?: boolean;
  animeId?: string;
  animeTitle?: string;
}

export const Image = ({ src, alt, className, fallbackClassName, priority, animeId, animeTitle, ...props }: ImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(src);
  const [fallbackLevel, setFallbackLevel] = useState(0); // 0: Initial, 1: Anilist, 2: Failed

  useEffect(() => {
      setImageSrc(src);
      setFallbackLevel(0);
  }, [src]);

  // If src is missing initially, start fallback chain immediately
  useEffect(() => {
      if ((!src || src === FALLBACK_IMAGE) && fallbackLevel === 0) {
          setFallbackLevel(1);
      }
  }, [src, fallbackLevel]);

  useEffect(() => {
      if (fallbackLevel === 1 && animeTitle) {
          let active = true;
          fetchAnilistImage(animeTitle).then(url => {
              if (active) {
                  if (url) {
                      setImageSrc(url);
                  } else {
                      setFallbackLevel(2); // Give up
                  }
              }
          }).catch(() => active && setFallbackLevel(2));
          return () => { active = false; };
      }
  }, [fallbackLevel, animeTitle]);

  const handleError = () => {
      if (fallbackLevel < 2) {
          setFallbackLevel(prev => prev + 1);
      }
  };

  if (fallbackLevel === 2 || (!imageSrc && fallbackLevel === 0 && !animeId)) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-slate-500 overflow-hidden ${className} ${fallbackClassName || ''}`}>
        <img src={FALLBACK_IMAGE} alt="" className="w-full h-full object-cover opacity-50 grayscale" />
      </div>
    );
  }

  return (
    <img
      src={imageSrc || FALLBACK_IMAGE}
      alt={alt}
      className={className}
      onError={handleError}
      loading={priority ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      // @ts-ignore
      fetchpriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      {...props}
    />
  );
};
