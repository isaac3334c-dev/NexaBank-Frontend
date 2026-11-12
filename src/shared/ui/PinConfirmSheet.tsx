import { useState } from 'react';
import { authApi } from '@/features/auth/authApi';
import { getErrorMessage } from '@/shared/lib/api';
import { BottomSheet } from './BottomSheet';
import { NumericKeypad } from './NumericKeypad';

const PIN_LENGTH = 4;

export interface PinConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Called with the confirmationToken once the PIN is verified against the backend. */
  onConfirmed: (confirmationToken: string) => void | Promise<void>;
}

/**
 * Shared "enter your PIN to confirm" bottom sheet — the same confirmation
 * pattern already used inline in transfer/steps/ConfirmStep.tsx, extracted
 * so money-moving flows (cards, topup, withdraw, QR pay) added in Phase F
 * reuse one implementation instead of re-inventing PIN entry each time.
 *
 * Calls POST /auth/pin/verify (via authApi.verifyPin) to exchange the PIN
 * for a short-lived X-Confirmation-Token, then hands that token to the
 * caller's onConfirmed — the caller is responsible for using it on the
 * actual money-moving request (and for closing the sheet on success).
 */
export function PinConfirmSheet({
  open,
  onOpenChange,
  title = 'Ingresa tu PIN',
  description = 'Confirma con tu PIN para continuar',
  onConfirmed,
}: PinConfirmSheetProps) {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  function reset() {
    setPin('');
    setError(null);
    setSubmitting(false);
  }

  async function handleKey(key: string) {
    if (submitting) return;
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      setSubmitting(true);
      setError(null);
      try {
        const pinResponse = await authApi.verifyPin(next);
        if (!pinResponse.confirmationToken) {
          throw new Error('No se pudo confirmar tu PIN.');
        }
        await onConfirmed(pinResponse.confirmationToken);
        reset();
      } catch (err) {
        setError(getErrorMessage(err));
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setPin('');
        setSubmitting(false);
      }
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={title}
    >
      <div className="flex flex-col items-center pt-1 pb-2">
        <p className="text-body text-text-muted text-center mb-6">{description}</p>

        <div className={`flex items-center justify-center gap-4 mb-6 ${shake ? 'animate-shake' : ''}`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`size-4 rounded-full ${i < pin.length ? 'bg-primary' : 'bg-surface-2 border border-border'}`}
            />
          ))}
        </div>

        {error && <p className="text-caption text-danger text-center mb-4">{error}</p>}
        {submitting && <p className="text-caption text-text-muted text-center mb-4">Verificando…</p>}

        <div className="w-full">
          <NumericKeypad onKey={handleKey} showDecimal={false} />
        </div>
      </div>
    </BottomSheet>
  );
}
