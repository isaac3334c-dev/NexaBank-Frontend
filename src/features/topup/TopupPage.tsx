import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Banknote, Building2, CreditCard, Wallet } from 'lucide-react';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';
import { PinConfirmSheet } from '@/shared/ui/PinConfirmSheet';
import {
  useInvalidateTopups,
  useTopupsQuery,
  useWalletQuery,
  type TopupResponse,
} from '@/shared/lib/queries';
import { getErrorMessage } from '@/shared/lib/api';
import { formatSignedMoney } from '@/shared/lib/money';
import { topupApi, type TopupSource } from './topupApi';

const SOURCES: Array<{ value: TopupSource; label: string; icon: typeof CreditCard }> = [
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Transferencia bancaria', icon: Building2 },
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
};

export function TopupPage() {
  const walletQuery = useWalletQuery();
  const topupsQuery = useTopupsQuery();
  const invalidateTopups = useInvalidateTopups();

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<TopupSource>('CARD');
  const [pinOpen, setPinOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const account = walletQuery.data?.[0];
  const hasAmount = Number(amount) > 0;

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
      await topupApi.create(
        { accountId: account.id, amount: Number(amount), currency: account.currency, source },
        confirmationToken,
      );
      invalidateTopups();
      setPinOpen(false);
      setAmount('');
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
      throw err; // keeps PinConfirmSheet open with its own inline error too
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title="Recargar" />

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
              {success && <p className="text-caption text-success">Recarga iniciada correctamente</p>}
              {error && <p className="text-caption text-danger">{error}</p>}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <p className="text-caption text-text-muted">Origen de la recarga</p>
              <div className="flex gap-2">
                {SOURCES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSource(value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-3 min-h-[44px] transition-colors duration-200 ${
                      source === value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-muted'
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
              disabled={!hasAmount}
              onClick={() => {
                setError(null);
                setPinOpen(true);
              }}
              className="mb-6"
            >
              Recargar
            </Button>

            <TopupHistory query={topupsQuery} />
          </>
        )}
      </div>

      <PinConfirmSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Confirma la recarga"
        description="Ingresa tu PIN para recargar tu cuenta"
        onConfirmed={handlePinConfirmed}
      />
    </div>
  );
}

function TopupHistory({ query }: { query: UseQueryResult<TopupResponse[]> }) {
  const topups = query.data ?? [];
  return (
    <section className="flex flex-col gap-1 pb-6">
      <h2 className="text-h3 text-text mb-1">Recargas recientes</h2>
      {query.isLoading ? (
        <Skeleton variant="list" rows={3} />
      ) : query.isError ? (
        <ErrorState description="No pudimos cargar tu historial." action={{ label: 'Reintentar', onClick: () => query.refetch() }} />
      ) : topups.length === 0 ? (
        <EmptyState icon={Wallet} title="Sin recargas" description="Tus recargas aparecerán aquí." />
      ) : (
        <div className="flex flex-col gap-2">
          {topups.map((topup) => (
            <Card key={topup.id} variant="outlined" className="flex items-center justify-between py-3">
              <div>
                <p className="text-body-strong text-text">
                  {SOURCES.find((s) => s.value === topup.source)?.label ?? topup.source}
                </p>
                <p className="text-caption text-text-muted">{new Date(topup.createdAt).toLocaleString('es-PE')}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-body-strong font-tabular text-success">
                  {formatSignedMoney({ amount: String(topup.amount), currency: topup.currency }, 'in')}
                </span>
                <Badge variant={STATUS_VARIANT[topup.status] ?? 'info'}>{topup.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
