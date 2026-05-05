'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContext = { value: string; setValue: (v: string) => void };
const Ctx = React.createContext<TabsContext | null>(null);

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const value = controlled ?? internal;
  const setValue = (v: string) => {
    if (onValueChange) onValueChange(v);
    if (controlled === undefined) setInternal(v);
  };
  return <Ctx.Provider value={{ value, setValue }}><div className={className}>{children}</div></Ctx.Provider>;
}

export function TabsList({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground gap-1', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('TabsTrigger must be used inside <Tabs>');
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('TabsContent must be used inside <Tabs>');
  if (ctx.value !== value) return null;
  return <div className={cn('mt-4', className)}>{children}</div>;
}
