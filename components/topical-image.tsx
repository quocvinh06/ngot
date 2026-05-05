import { topicalImageUrl } from '@/lib/topical-image';
import { cn } from '@/lib/utils';

/**
 * <TopicalImage> renders entity.photoUrl when present, otherwise falls back to a deterministic
 * loremflickr photo tagged for the entity. Per visual-content.md v0.6.3 — never picsum.
 */
export function TopicalImage({
  src,
  seed,
  alt,
  entityName,
  width = 800,
  height = 500,
  className,
  priority,
}: {
  src?: string | null;
  seed: string;
  alt: string;
  entityName?: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const url = src && src.length > 0 ? src : topicalImageUrl(seed, width, height, entityName);
  // Use plain <img> for list cards (cheaper, no remotePatterns required for loremflickr query strings)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      className={cn('object-cover', className)}
    />
  );
}
