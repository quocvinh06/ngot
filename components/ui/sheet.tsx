'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type SheetContextType = { open: boolean; setOpen: (v: boolean) => void };
const SheetCtx = React.createContext<SheetContextType | null>(null);

export function Sheet({
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
  return <SheetCtx.Provider value={{ open, setOpen }}>{children}</SheetCtx.Provider>;
}

export function SheetTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
}) {
  const ctx = React.useContext(SheetCtx);
  if (!ctx) throw new Error('SheetTrigger must be used inside <Sheet>');
  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        ctx.setOpen(true);
      },
    });
  }
  return (
    <button type="button" onClick={() => ctx.setOpen(true)}>
      {children}
    </button>
  );
}

export function SheetContent({
  side = 'right',
  className,
  children,
}: {
  side?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(SheetCtx);
  if (!ctx) throw new Error('SheetContent must be used inside <Sheet>');
  if (!ctx.open) return null;
  const sideClass: Record<string, string> = {
    right: 'right-0 top-0 h-full w-3/4 max-w-md border-l',
    left: 'left-0 top-0 h-full w-3/4 max-w-md border-r',
    top: 'left-0 top-0 w-full max-h-[80vh] border-b',
    bottom: 'left-0 bottom-0 w-full max-h-[80vh] border-t',
  };
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={() => ctx.setOpen(false)} />
      <div className={cn('absolute bg-background p-6 shadow-xl overflow-y-auto', sideClass[side], className)}>
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

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
