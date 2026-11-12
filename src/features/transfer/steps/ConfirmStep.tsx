import { useState } from 'react';
import { useWalletQuery, useInvalidateWallet } from '@/shared/lib/queries';
import { useTransferFlowStore } from '../transferStore';
import { transferApi } from '../transferApi';
import { authApi } from '@/features/auth/authApi';
import { getErrorMessage } from '@/shared/lib/api';
import { formatMoney } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';

const PIN_LENGTH = 4;

export function ConfirmStep() {
  const account = useWalletQuery().data?.[0];
  const invalidateWallet = useInvalidateWallet();
  const recipient = useTransferFlowStore((s) => s.recipient);
  const amount = useTransferFlowStore((s) => s.amount);
  const quote = useTransferFlowStore((s) => s.quote);
  const setResult = useTransferFlowStore((s) => s.setResult);

  const [confirming, setConfirming] = useState(false);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  if (!recipient || !account || !quote) return null;

  const currency = account.currency;
  const safeQuote = quote;

  async function handlePinKey(key: string) {
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
        const transfer = await transferApi.create(
          {
            sourceAccountId: safeQuote.sourceAccountId,
            destinationAccountId: safeQuote.destinationAccountId,
            amount: safeQuote.sourceAmount,
            sourceCurrency: safeQuote.sourceCurrency,
            destinationCurrency: safeQuote.destinationCurrency,
            currency: safeQuote.sourceCurrency,
          },
          pinResponse.confirmationToken,
        );
        invalidateWallet();
        setResult(transfer);
      } catch (err) {
        // Keep amount/recipient/quote state intact — only the PIN attempt
        // resets, so the user can just retry without restarting the flow.
        setError(getErrorMessage(err));
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setPin('');
      } finally {
        setSubmitting(false);
      }
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col h-full px-5 pt-4">
        <div className="flex flex-col gap-2 mb-10 items-center text-center">
          <h1 className="text-h1 text-text">Ingresa tu PIN</h1>
          <p className="text-body text-text-muted">Confirma con tu PIN para enviar el dinero</p>
        </div>

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
        {submitting && <p className="text-caption text-text-muted text-center mb-4">Enviando…</p>}

        <div className="mt-auto">
          <NumericKeypad onKey={handlePinKey} showDecimal={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-5 pt-4">
      <div className="flex flex-col items-center gap-2 mb-6">
        <Avatar name={recipient.displayName} size="lg" />
        <p className="text-body-strong text-text">{recipient.displayName}</p>
        <p className="text-caption text-text-muted">{recipient.phone}</p>
      </div>

      <Card variant="outlined" className="flex flex-col gap-3">
        <Row label="Monto" value={formatMoney({ amount, currency })} />
        <Row label="Comisión" value={formatMoney({ amount: String(quote.fee), currency })} />
        <div className="h-px bg-border" />
        <Row label="Total a enviar" value={formatMoney({ amount: String(quote.total), currency })} strong />
        <Row
          label="Saldo resultante"
          value={formatMoney({ amount: String(account.balance - quote.total), currency })}
          muted
        />
      </Card>

      <div className="flex-1" />

      <Button size="lg" fullWidth onClick={() => setConfirming(true)} className="mb-2">
        Confirmar envío
      </Button>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body text-text-muted">{label}</span>
      <span
        className={
          strong
            ? 'text-body-strong font-tabular text-text'
            : muted
              ? 'text-caption font-tabular text-text-muted'
              : 'text-body font-tabular text-text'
        }
      >
        {value}
      </span>
    </div>
  );
}
