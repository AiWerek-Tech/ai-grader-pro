'use client';

import Image from 'next/image';
import { withBasePath } from '@/lib/base-path';

interface BrandLogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol' | 'app-icon';
  className?: string;
  priority?: boolean;
}

/**
 * Komponen BrandLogo Resmi WMVAA AI Grader Pro
 * Otomatis menyesuaikan varian terang/gelap (Light/Dark Mode) dan basePath hosting.
 */
export function BrandLogo({
  variant = 'horizontal',
  className = '',
  priority = false,
}: BrandLogoProps) {
  if (variant === 'symbol') {
    return (
      <Image
        src={withBasePath('/brand/wmvaa_logo_symbol.png')}
        alt="WMVAA AI Grader Pro"
        width={120}
        height={120}
        priority={priority}
        className={`object-contain ${className}`}
      />
    );
  }

  if (variant === 'app-icon') {
    return (
      <Image
        src={withBasePath('/brand/wmvaa_app_icon.png')}
        alt="WMVAA AI Grader Pro"
        width={120}
        height={120}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }

  if (variant === 'vertical') {
    return (
      <>
        <Image
          src={withBasePath('/brand/wmvaa_logo_vertical_dark.png')}
          alt="WMVAA AI Grader Pro"
          width={280}
          height={350}
          priority={priority}
          className={`block dark:hidden object-contain ${className}`}
        />
        <Image
          src={withBasePath('/brand/wmvaa_logo_vertical_light.png')}
          alt="WMVAA AI Grader Pro"
          width={280}
          height={350}
          priority={priority}
          className={`hidden dark:block object-contain ${className}`}
        />
      </>
    );
  }

  // Default: horizontal
  return (
    <>
      <Image
        src={withBasePath('/brand/wmvaa_logo_horizontal_dark.png')}
        alt="WMVAA AI Grader Pro"
        width={340}
        height={190}
        priority={priority}
        className={`block dark:hidden object-contain ${className}`}
      />
      <Image
        src={withBasePath('/brand/wmvaa_logo_horizontal_light.png')}
        alt="WMVAA AI Grader Pro"
        width={340}
        height={190}
        priority={priority}
        className={`hidden dark:block object-contain ${className}`}
      />
    </>
  );
}
