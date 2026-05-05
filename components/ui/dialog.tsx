'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type DialogContextType = { open: boolean; setOpen: (v: boolean) => void };
const DialogCtx = React.createContext<DialogContextType | null>(null);

export function Dialog({
  open: controlled,
  onOpenChange,
  defaultOpen,
  children,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false);
  const open = controlled ?? internal;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    if (controlled === undefined) setInternal(v);
  };
  return <DialogCtx.Provider value={{ open, setOpen }}>{children}</DialogCtx.Provider>;
}

export function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
}) {
  const ctx = React.useContext(DialogCtx);
  if (!ctx) throw new Error('DialogTrigger must be used inside <Dialog>');
  const child = children;
  if (asChild) {
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        ctx.setOpen(true);
      },
    });
  }
  return (
    <button type="button" onClick={() => ctx.setOpen(true)}>
      {child}
    </button>
  );
}

export function DialogContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(DialogCtx);
  if (!ctx) throw new Error('DialogContent must be used inside <Dialog>');
  if (!ctx.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        className={cn(
          'relative z-10 grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-lg',
          className,
        )}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => ctx.setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
