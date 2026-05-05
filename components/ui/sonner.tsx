'use client';
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="light"
      richColors
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'border bg-background text-foreground',
        },
      }}
      {...props}
    />
  );
}
