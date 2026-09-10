'use client';

import Image from 'next/image';

interface GovtLogoProps {
  size?: number;
  className?: string;
}

export default function GovtLogo({ size = 48, className = '' }: GovtLogoProps) {
  return (
    <Image
      src="/govt-pakistan-logo.png"
      alt="Government of Pakistan"
      width={size}
      height={size}
      className={className}
    />
  );
}
