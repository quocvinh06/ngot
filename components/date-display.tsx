import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function DateDisplay({
  date,
  fmt = 'dd/MM/yyyy HH:mm',
  className,
}: {
  date: Date | string | null | undefined;
  fmt?: string;
  className?: string;
}) {
  if (!date) return <span className={className}>—</span>;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return <span className={className}>—</span>;
  return <span className={className}>{format(d, fmt, { locale: vi })}</span>;
}
