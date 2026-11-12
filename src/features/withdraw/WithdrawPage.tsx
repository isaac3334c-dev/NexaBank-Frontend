import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Banknote, Building2, CreditCard, Landmark, X } from 'lucide-react';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { IconButton } from '@/shared/ui/IconButton';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';
import { PinConfirmSheet } from '@/shared/ui/PinConfirmSheet';
import {
  useInvalidateWithdrawals,
  useWithdrawalsQuery,
  useWalletQuery,
  type WithdrawalResponse,
} from '@/shared/lib/queries';
import { getErrorMessage } from '@/shared/lib/api';
import { isAmountWithinBalance, formatSignedMoney } from '@/shared/lib/money';
import { withdrawApi, type WithdrawalDestination } from './withdrawApi';

const DESTINATIONS: Array<{ value: WithdrawalDestination; label: string; icon: typeof CreditCard }> = [
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Transferencia bancaria', icon: Building2 },
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  CANCELLED: 'info',
};

export function WithdrawPage() {
  const walletQuery = useWalletQuery();
  const withdrawalsQuery = useWithdrawalsQuery();
  const invalidateWithdrawals = useInvalidateWithdrawals();

  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState<WithdrawalDestination>('BANK_TRANSFER');
  const [pinOpen, setPinOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const account = walletQuery.data?.[0];
  const balance = account?.balance.toString() ?? '0';
  const withinBalance = amount === '' || isAmountWithinBalance(amount, balance);
  const hasAmount = Number(amount) > 0;
  const canContinue = hasAmount && withinBalance;

  function handleKey(key: string) {
    if (key === 'back') {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    if (key === '.' && amount.includes('.')) return;
    const next = amount + key;
    const decimals = next.split('.')[1];
    if (decimals && decimals.length > 2) return;
    if (next.replace('.', '').length > 9) return;
    setAmount(next);
    setSuccess(false);
  }

  async function handlePinConfirmed(confirmationToken: string) {
    if (!account) return;
    try {
      await withdrawApi.create(
        { accountId: account.id, amount: Number(amount), currency: account.currency, destination },
        confirmationToken,
      );
      invalidateWithdrawals();
      setPinOpen(false);
      setAmount('');
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    }
  }

  async function handleCancel(id: string) {
    try {
      await withdrawApi.cancel(id);
      invalidateWithdrawals();
    } catch (err) {
      window.alert(getErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title="Retirar" />

      <div className="flex-1 flex flex-col px-5 pt-2">
        {walletQuery.isLoading ? (
          <Skeleton variant="card" className="h-40" />
        ) : walletQuery.isError || !account ? (
          <ErrorState description="No pudimos cargar tu cuenta." action={{ label: 'Reintentar', onClick: () => walletQuery.refetch() }} />
        ) : (
          <>
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <p aria-live="polite">
                <MoneyDisplay
                  formatted={`${account.currency} ${amount || '0'}`}
                  className="inline-flex items-baseline"
                  wholeClassName="font-tabular text-text text-[40px] font-semibold tracking-[-0.02em]"
                  decimalClassName="font-tabular text-text-muted text-[24px] font-semibold tracking-[-0.02em]"
                />
              </p>
              {!withinBalance && <p className="text-caption text-danger">Saldo insuficiente</p>}
              {success && <p className="text-caption text-success">Retiro iniciado correctamente</p>}
              {error && <p className="text-caption text-danger">{error}</p>}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <p className="text-caption text-text-muted">Destino del retiro</p>
              <div className="flex gap-2">
                {DESTINATIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDestination(value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-3 min-h-[44px] transition-colors duration-200 ${
                      destination === value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-muted'
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-caption">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <NumericKeypad onKey={handleKey} showDecimal />

            <Button
              size="lg"
              fullWidth
              disabled={!canContinue}
              onClick={() => {
                setError(null);
                setPinOpen(true);
              }}
              className="mb-6"
            >
              Retirar
            </Button>

            <WithdrawalHistory query={withdrawalsQuery} onCancel={handleCancel} />
          </>
        )}
      </div>

      <PinConfirmSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Confirma el retiro"
        description="Ingresa tu PIN para retirar dinero de tu cuenta"
        onConfirmed={handlePinConfirmed}
      />
    </div>
  );
}

function WithdrawalHistory({
  query,
  onCancel,
}: {
  query: UseQueryResult<WithdrawalResponse[]>;
  onCancel: (id: string) => void;
}) {
  const withdrawals = query.data ?? [];
  return (
    <section className="flex flex-col gap-1 pb-6">
      <h2 className="text-h3 text-text mb-1">Retiros recientes</h2>
      {query.isLoading ? (
        <Skeleton variant="list" rows={3} />
      ) : query.isError ? (
        <ErrorState description="No pudimos cargar tu historial." action={{ label: 'Reintentar', onClick: () => query.refetch() }} />
      ) : withdrawals.length === 0 ? (
        <EmptyState icon={Landmark} title="Sin retiros" description="Tus retiros aparecerán aquí." />
      ) : (
        <div className="flex flex-col gap-2">
          {withdrawals.map((withdrawal) => (
            <Card key={withdrawal.id} variant="outlined" className="flex items-center justify-between py-3">
              <div>
                <p className="text-body-strong text-text">
                  {DESTINATIONS.find((d) => d.value === withdrawal.destination)?.label ?? withdrawal.destination}
                </p>
                <p className="text-caption text-text-muted">
                  {new Date(withdrawal.createdAt).toLocaleString('es-PE')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-body-strong font-tabular text-danger">
                    {formatSignedMoney({ amount: String(withdrawal.amount), currency: withdrawal.currency }, 'out')}
                  </span>
                  <Badge variant={STATUS_VARIANT[withdrawal.status] ?? 'info'}>{withdrawal.status}</Badge>
                </div>
                {withdrawal.status === 'PENDING' && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    icon={<X className="size-4" />}
                    aria-label="Cancelar retiro"
                    onClick={() => onCancel(withdrawal.id)}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
