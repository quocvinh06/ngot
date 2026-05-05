import { formatVND } from '@/lib/utils';

export function CurrencyDisplay({ cents, className }: { cents: number | null | undefined; className?: string }) {
  return <span className={className}>{formatVND(cents ?? 0)}</span>;
}
