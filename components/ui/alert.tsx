import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'destructive' | 'warning';
const VARIANTS: Record<Variant, string> = {
  default: 'bg-muted text-foreground',
  destructive: 'border-destructive/50 text-destructive',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn('relative w-full rounded-lg border p-4 text-sm', VARIANTS[variant], className)}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn('mb-1 font-medium leading-tight tracking-tight', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';
