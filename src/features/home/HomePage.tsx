import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft, Wallet, Landmark, ArrowDown, ArrowUp } from 'lucide-react';
import { useAuthStore } from '@/shared/store/authStore';
import { useWalletQuery, useTransactionsQuery, type TransactionResponse } from '@/shared/lib/queries';
import { BalanceCard } from '@/shared/ui/BalanceCard';
import { QuickAction } from '@/shared/ui/QuickAction';
import { Avatar } from '@/shared/ui/Avatar';
import { EmptyState, ErrorState } from '@/shared/ui/EmptyState';
import { formatSignedMoney } from '@/shared/lib/money';

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const walletQuery = useWalletQuery();
  const transactionsQuery = useTransactionsQuery();

  const firstName = (user?.displayName ?? '').split(' ')[0] || 'Hola';
  const account = walletQuery.data?.[0];
  const recentTransactions = transactionsQuery.data?.data.slice(0, 5) ?? [];

  return (
    <div className="flex flex-col gap-6 pb-6 px-5 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-text-muted">Hola,</p>
          <h1 className="text-h2 text-text">{firstName}</h1>
        </div>
        <Avatar name={user?.displayName ?? ''} size="md" />
      </div>

      {walletQuery.isLoading ? (
        <div className="h-[132px] rounded-[var(--radius-card)] bg-surface-2 animate-pulse" aria-hidden="true" />
      ) : walletQuery.isError || !account ? (
        <ErrorState
          description="No pudimos cargar tu saldo."
          action={{ label: 'Reintentar', onClick: () => walletQuery.refetch() }}
        />
      ) : (
        <BalanceCard balance={{ amount: account.balance.toString(), currency: account.currency }} />
      )}

      <div className="grid grid-cols-4 gap-1">
        <QuickAction
          icon={<ArrowUpRight className="size-6" />}
          label="Enviar"
          onClick={() => navigate('/transfer')}
        />
        <QuickAction
          icon={<ArrowDownLeft className="size-6" />}
          label="Recibir"
          onClick={() => navigate('/app/receive')}
        />
        <QuickAction
          icon={<Wallet className="size-6" />}
          label="Recargar"
          onClick={() => navigate('/app/topup')}
        />
        <QuickAction
          icon={<Landmark className="size-6" />}
          label="Retirar"
          onClick={() => navigate('/app/withdraw')}
        />
      </div>

      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-text">Movimientos recientes</h2>
          <Link to="/app/activity" className="text-caption text-primary font-medium">
            Ver todo
          </Link>
        </div>

        {transactionsQuery.isLoading ? (
          <div className="flex flex-col gap-2 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 rounded-[var(--radius-md)] bg-surface-2 animate-pulse" aria-hidden="true" />
            ))}
          </div>
        ) : transactionsQuery.isError ? (
          <ErrorState
            description="No pudimos cargar tus movimientos."
            action={{ label: 'Reintentar', onClick: () => transactionsQuery.refetch() }}
          />
        ) : recentTransactions.length === 0 ? (
          <EmptyState title="Aún no tienes movimientos" description="Tus transferencias y pagos aparecerán aquí." />
        ) : (
          <div className="flex flex-col gap-1">
            {recentTransactions.map((tx) => (
              <WalletTransactionRow key={tx.id} transaction={tx} currency={account?.currency ?? 'PEN'} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// The real /transactions endpoint returns a leaner shape (name/note/amount/
// incoming/color) than the richer mock Transaction domain type (which also
// carried type/status/createdAt for TransactionItem's icon+badge+date
// treatment) — those fields don't exist on the backend response, so this
// renders the subset that's actually available instead of fabricating them.
function WalletTransactionRow({
  transaction,
  currency,
}: {
  transaction: TransactionResponse;
  currency: string;
}) {
  const Icon = transaction.incoming ? ArrowDown : ArrowUp;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="flex items-center justify-center size-11 rounded-full shrink-0"
        style={{
          backgroundColor: transaction.incoming ? 'var(--color-success-soft)' : 'var(--color-surface-2)',
          color: transaction.color ?? (transaction.incoming ? 'var(--color-success)' : 'var(--color-text-muted)'),
        }}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-body-strong text-text truncate">{transaction.name}</p>
        {transaction.note && <p className="text-caption text-text-muted truncate">{transaction.note}</p>}
      </div>

      <span
        className="text-body-strong font-tabular shrink-0"
        style={{ color: transaction.incoming ? 'var(--color-amount-in)' : 'var(--color-amount-out)' }}
      >
        {formatSignedMoney({ amount: String(transaction.amount), currency }, transaction.incoming ? 'in' : 'out')}
      </span>
    </div>
  );
}
