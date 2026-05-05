'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type DDContext = { open: boolean; setOpen: (v: boolean) => void };
const DDCtx = React.createContext<DDContext | null>(null);

export function DropdownMenu({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <DDCtx.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DDCtx.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
}) {
  const ctx = React.useContext(DDCtx);
  if (!ctx) throw new Error('DropdownMenuTrigger must be used inside <DropdownMenu>');
  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        ctx.setOpen(!ctx.open);
      },
    });
  }
  return (
    <button type="button" onClick={() => ctx.setOpen(!ctx.open)}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = 'end',
  className,
  children,
}: {
  align?: 'start' | 'end' | 'center';
  className?: string;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(DDCtx);
  if (!ctx) throw new Error('DropdownMenuContent must be used inside <DropdownMenu>');
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ctx.open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ctx?.setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ctx]);
  if (!ctx.open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 mt-1 min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  onSelect,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }) {
  const ctx = React.useContext(DDCtx);
  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={(e) => {
        props.onClick?.(e);
        onSelect?.();
        ctx?.setOpen(false);
      }}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />;
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />;
}
