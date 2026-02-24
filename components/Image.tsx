import React, { useState, ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  priority?: boolean;
}

export const Image = ({ src, alt, className, fallbackClassName, priority, ...props }: ImageProps) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-slate-500 ${className} ${fallbackClassName || ''}`}>
        <ImageOff className="w-1/3 h-1/3 opacity-50" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading={priority ? "eager" : "lazy"}
      // @ts-ignore
      fetchpriority={priority ? "high" : "auto"}
      {...props}
    />
  );
};
