import Image from 'next/image';
import { cn } from '@/lib/utils';

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 32, md: 56, lg: 96 };

export interface BrandLogoProps {
  variant?: 'mark' | 'wordmark' | 'both';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Brand logo for Ngọt — uses the user-authored asset at /brand/ngot-logo.png.
 * variant="both" renders the full logo image (mark + wordmark + tagline).
 * variant="wordmark" renders just the lowercase serif "ngọt" text.
 * variant="mark" renders a circular crop of the logo.
 */
export function BrandLogo({ variant = 'both', size = 'md', className }: BrandLogoProps) {
  const px = SIZE_PX[size];
  if (variant === 'wordmark') {
    return (
      <span
        className={cn(
          'font-display italic text-cocoa leading-none tracking-tight',
          size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-6xl',
          className,
        )}
        aria-label="ngọt"
      >
        ngọt
      </span>
    );
  }
  if (variant === 'mark') {
    return (
      <div
        className={cn('relative overflow-hidden rounded-full bg-rose', className)}
        style={{ width: px, height: px }}
      >
        <Image
          src="/brand/ngot-logo.png"
          alt="Ngọt"
          width={px * 2}
          height={px * 2}
          className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 object-cover"
          priority
        />
      </div>
    );
  }
  // both — full logo PNG
  const w = size === 'sm' ? 96 : size === 'md' ? 180 : 320;
  const h = Math.round(w * 1.25);
  return (
    <Image
      src="/brand/ngot-logo.png"
      alt="Ngọt — Patissiere & More"
      width={w}
      height={h}
      className={cn('h-auto w-auto', className)}
      priority
    />
  );
}
