import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-input text-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  success: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  warning: 'bg-amber-100 text-amber-900 border border-amber-200',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
