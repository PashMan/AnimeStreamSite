import React, { useState, useEffect, ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';
import { fetchKodikImage } from '../services/kodik';
import { FALLBACK_IMAGE } from '../constants';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  priority?: boolean;
  animeId?: string;
  animeTitle?: string;
}

export const Image = ({ src, alt, className, fallbackClassName, priority, animeId, animeTitle, ...props }: ImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(src);
  const [hasTriedKodik, setHasTriedKodik] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
      setImageSrc(src);
      setHasTriedKodik(false);
      setError(false);
  }, [src]);

  useEffect(() => {
    if ((error || imageSrc === FALLBACK_IMAGE) && animeId && !hasTriedKodik) {
      setHasTriedKodik(true);
      fetchKodikImage(animeId, animeTitle).then(kodikImage => {
        if (kodikImage) {
            setImageSrc(kodikImage);
            setError(false);
        }
      }).catch(() => {});
    }
  }, [error, imageSrc, animeId, animeTitle, hasTriedKodik]);

  if (error && (!animeId || hasTriedKodik)) {
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
      onError={() => setError(true)}
      loading={priority ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      // @ts-ignore
      fetchpriority={priority ? "high" : "auto"}
      {...props}
    />
  );
};
