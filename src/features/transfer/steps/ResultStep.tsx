import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '@/shared/store/walletStore';
import { useTransferFlowStore } from '../transferStore';
import { formatMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Circle + checkmark path lengths for the stroke-dasharray/dashoffset draw
// animation. Computed to match the exact geometry below (r=38 circle
// circumference ~= 238.76; the check polyline is two short segments).
const CIRCLE_LENGTH = 238.76;
const CHECK_LENGTH = 48;

export function ResultStep() {
  const navigate = useNavigate();
  const account = useWalletStore((s) => s.account);
  const contact = useTransferFlowStore((s) => s.contact);
  const amount = useTransferFlowStore((s) => s.amount);
  const reset = useTransferFlowStore((s) => s.reset);

  const [settled, setSettled] = useState(prefersReducedMotion());

  useEffect(() => {
    // Short haptic pulse on arrival — feature-detected, no-op where
    // navigator.vibrate is unsupported (e.g. desktop browsers, iOS Safari).
    navigator.vibrate?.([15]);

    if (prefersReducedMotion()) return;
    // Let the checkmark draw first (420ms, see .animate-checkmark in
    // src/styles/index.css), then let the final amount "land" into place.
    const timer = window.setTimeout(() => setSettled(true), 420);
    return () => window.clearTimeout(timer);
  }, []);

  if (!contact) return null;

  function handleFinish() {
    reset();
    navigate('/app/home');
  }

  return (
    <div className="flex flex-col h-full items-center justify-center px-5 text-center gap-4">
      <span
        className="flex items-center justify-center size-20 rounded-full"
        style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }}
        aria-hidden="true"
      >
        <svg width="40" height="40" viewBox="0 0 80 80" fill="none">
          <circle
            cx="40"
            cy="40"
            r="38"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={CIRCLE_LENGTH}
            className={prefersReducedMotion() ? '' : 'animate-checkmark'}
            style={
              prefersReducedMotion()
                ? undefined
                : ({ '--checkmark-length': CIRCLE_LENGTH } as React.CSSProperties)
            }
            strokeDashoffset={prefersReducedMotion() ? 0 : undefined}
          />
          <polyline
            points="24,42 35,53 57,29"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={CHECK_LENGTH}
            className={prefersReducedMotion() ? '' : 'animate-checkmark'}
            style={
              prefersReducedMotion()
                ? undefined
                : ({
                    '--checkmark-length': CHECK_LENGTH,
                    animationDelay: '280ms',
                  } as React.CSSProperties)
            }
            strokeDashoffset={prefersReducedMotion() ? 0 : undefined}
          />
        </svg>
      </span>

      <div
        className="transition-[opacity,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        style={{
          opacity: settled ? 1 : 0,
          transform: settled ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
        }}
      >
        <h1 className="text-h2 text-text">¡Envío exitoso!</h1>
        <p className="text-body text-text-muted mt-1">
          Enviaste {formatMoney({ amount, currency: account.balance.currency })} a {contact.name}
        </p>
      </div>

      <Button size="lg" fullWidth onClick={handleFinish} className="mt-6">
        Volver al inicio
      </Button>
    </div>
  );
}
