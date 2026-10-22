import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, prefix, suffix, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-body-strong text-text">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 rounded-[var(--radius-md)] border bg-surface px-3.5 h-12 transition-colors duration-200',
            hasError
              ? 'border-danger focus-within:border-danger'
              : 'border-border focus-within:border-primary',
          )}
        >
          {prefix && <span className="text-text-muted shrink-0">{prefix}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 min-w-0 bg-transparent text-text placeholder:text-text-muted outline-none text-[16px]',
              className,
            )}
            aria-invalid={hasError || undefined}
            aria-describedby={helperText || error ? helperId : undefined}
            {...props}
          />
          {suffix && <span className="text-text-muted shrink-0">{suffix}</span>}
        </div>
        {(helperText || error) && (
          <p id={helperId} className={cn('text-caption', hasError ? 'text-danger' : 'text-text-muted')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
