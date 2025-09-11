import React from 'react';

export function Avatar({ src, alt, size = 40 }: { src?: string; alt?: string; size?: number }) {
  return (
    <img
      src={src || '/default-player.png'}
      alt={alt || 'Avatar'}
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
} 