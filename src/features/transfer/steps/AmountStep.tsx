import { useState } from 'react';
import { useWalletQuery } from '@/shared/lib/queries';
import { useTransferFlowStore } from '../transferStore';
import { transferApi, type CreateTransferRequest } from '../transferApi';
import { getErrorMessage } from '@/shared/lib/api';
import { isAmountWithinBalance } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';

export function AmountStep() {
  const walletQuery = useWalletQuery();
  const account = walletQuery.data?.[0];
  const recipient = useTransferFlowStore((s) => s.recipient);
  const amount = useTransferFlowStore((s) => s.amount);
  const setAmount = useTransferFlowStore((s) => s.setAmount);
  const setQuote = useTransferFlowStore((s) => s.setQuote);
  const setStep = useTransferFlowStore((s) => s.setStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!recipient || !account) return null;

  const balance = account.balance.toString();
  const withinBalance = amount === '' || isAmountWithinBalance(amount, balance);
  const hasAmount = Number(amount) > 0;
  const canContinue = hasAmount && withinBalance;

  function handleKey(key: string) {
    if (key === 'back') {
      setAmount(amount.slice(0, -1));
      return;
    }
    if (key === '.' && amount.includes('.')) return;
    const next = amount + key;
    const decimals = next.split('.')[1];
    if (decimals && decimals.length > 2) return;
    if (next.replace('.', '').length > 9) return;
    setAmount(next);
  }

  async function handleContinue() {
    if (!canContinue) return;
    setLoading(true);
    setError(null);
    try {
      const request: CreateTransferRequest = {
        sourceAccountId: account!.id,
        destinationAccountId: recipient!.accountId,
        amount: Number(amount),
        sourceCurrency: account!.currency,
        destinationCurrency: account!.currency,
        currency: account!.currency,
      };
      const quote = await transferApi.quote(request);
      setQuote(quote);
      setStep('confirm');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full px-5 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <Avatar name={recipient.displayName} size="sm" />
        <div>
          <p className="text-caption text-text-muted">Para</p>
          <p className="text-body-strong text-text">{recipient.displayName}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <p aria-live="polite">
          <MoneyDisplay
            formatted={`${account.currency} ${amount || '0'}`}
            className="inline-flex items-baseline"
            wholeClassName="font-tabular text-text text-[44px] font-semibold tracking-[-0.02em]"
            decimalClassName="font-tabular text-text-muted text-[26.4px] font-semibold tracking-[-0.02em]"
          />
        </p>
        {!withinBalance && <p className="text-caption text-danger">Saldo insuficiente</p>}
        {error && <p className="text-caption text-danger">{error}</p>}
        <button
          type="button"
          className="text-caption text-primary font-medium mt-1"
          onClick={() => setAmount(balance)}
        >
          Usar todo
        </button>
      </div>

      <NumericKeypad onKey={handleKey} showDecimal />

      <Button size="lg" fullWidth loading={loading} disabled={!canContinue} onClick={handleContinue} className="mb-2">
        Continuar
      </Button>
    </div>
  );
}
