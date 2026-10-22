import { useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  /** Applied to the wrapper; used by callers to trigger a shake animation. */
  className?: string;
}

export function OtpInput({ length = 6, value, onChange, error, className }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  return (
    <div className={cn('flex gap-2 justify-between', className)} role="group" aria-label="Código de verificación">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Dígito ${i + 1}`}
          aria-invalid={error || undefined}
          className={cn(
            // Individual OTP boxes stay a rounded square (--radius-md) rather
            // than literal pill-shaped — a single-character box rendered as
            // a 999px pill would look like a squashed oval, not a chip. The
            // pill treatment from the brief is applied to the PIN dots and
            // NumericKeypad buttons in this same flow instead. See
            // docs/DECISIONS.md.
            'size-12 min-h-[44px] min-w-[44px] text-center text-h3 text-text rounded-[var(--radius-md)] border bg-surface outline-none transition-colors duration-200',
            error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary',
          )}
        />
      ))}
    </div>
  );
}
