'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  id?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked: controlled, defaultChecked, onCheckedChange, disabled, name, className, id }, ref) => {
    const [internal, setInternal] = React.useState(defaultChecked ?? false);
    const checked = controlled ?? internal;
    const toggle = () => {
      const v = !checked;
      if (onCheckedChange) onCheckedChange(v);
      if (controlled === undefined) setInternal(v);
    };
    return (
      <>
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={toggle}
          className={cn(
            'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary' : 'bg-input',
            className,
          )}
        >
          <span
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
        {name && <input type="hidden" name={name} value={checked ? 'on' : 'off'} />}
      </>
    );
  },
);
Switch.displayName = 'Switch';
