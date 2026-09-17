'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

interface GovtLogoProps {
  size?: number;
  className?: string;
  /** Soft white disc behind the badge (login / sidebar on green). */
  ring?: boolean;
}

/**
 * Official MNFSR seal, always clipped to a perfect circle.
 */
export default function GovtLogo({ size = 48, className = '', ring = false }: GovtLogoProps) {
  const clipId = useId().replace(/:/g, '');
  const imageRadius = ring ? 46 : 50;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('inline-block shrink-0', className)}
      role="img"
      aria-label="Ministry of National Food Security and Research"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r={imageRadius} />
        </clipPath>
      </defs>
      {ring ? <circle cx="50" cy="50" r="50" fill="#ffffff" /> : null}
      <image
        href="/mnfsr-logo.png"
        x={50 - imageRadius}
        y={50 - imageRadius}
        width={imageRadius * 2}
        height={imageRadius * 2}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}
