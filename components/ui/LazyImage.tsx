import React from 'react';

export function LazyImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  // TODO: Implement lazy loading/optimization
  return <img src={src} alt={alt} loading="lazy" {...props} />;
} 