import { useWalletStore } from '@/shared/store/walletStore';
import { useTransferFlowStore } from '../transferStore';
import { formatMoney, isAmountWithinBalance } from '@/shared/lib/money';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';

export function AmountStep() {
  const account = useWalletStore((s) => s.account);
  const contact = useTransferFlowStore((s) => s.contact);
  const amount = useTransferFlowStore((s) => s.amount);
  const setAmount = useTransferFlowStore((s) => s.setAmount);
  const setStep = useTransferFlowStore((s) => s.setStep);

  if (!contact) return null;

  const withinBalance = amount === '' || isAmountWithinBalance(amount || '0', account.balance.amount);
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

  return (
    <div className="flex flex-col h-full px-5 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <Avatar name={contact.name} size="sm" />
        <div>
          <p className="text-caption text-text-muted">Para</p>
          <p className="text-body-strong text-text">{contact.name}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <p aria-live="polite">
          {/* Same two-tier whole/decimal split as BalanceCard's hero
              balance (44px/600/-0.02em whole, 60%-size muted decimals) —
              applied here only once the user has actually typed a decimal
              point, otherwise it's rendered as a single whole-part string
              (there's no meaningful "decimal part" to mute while the
              integer portion is still being entered). */}
          <MoneyDisplay
            formatted={`${account.balance.currency} ${amount || '0'}`}
            className="inline-flex items-baseline"
            wholeClassName="font-tabular text-text text-[44px] font-semibold tracking-[-0.02em]"
            decimalClassName="font-tabular text-text-muted text-[26.4px] font-semibold tracking-[-0.02em]"
          />
        </p>
        {!withinBalance && (
          <p className="text-caption text-danger">Saldo insuficiente</p>
        )}
        <button
          type="button"
          className="text-caption text-primary font-medium mt-1"
          onClick={() => setAmount(account.balance.amount)}
        >
          Usar todo ({formatMoney(account.balance)})
        </button>
      </div>

      <NumericKeypad onKey={handleKey} showDecimal />

      <Button size="lg" fullWidth disabled={!canContinue} onClick={() => setStep('confirm')} className="mb-2">
        Continuar
      </Button>
    </div>
  );
}
