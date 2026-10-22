import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft, Wallet, Landmark } from 'lucide-react';
import { useWalletStore } from '@/shared/store/walletStore';
import { BalanceCard } from '@/shared/ui/BalanceCard';
import { QuickAction } from '@/shared/ui/QuickAction';
import { Avatar } from '@/shared/ui/Avatar';
import { TransactionItem } from '@/shared/ui/TransactionItem';
import { EmptyState } from '@/shared/ui/EmptyState';

export function HomePage() {
  const navigate = useNavigate();
  const account = useWalletStore((s) => s.account);
  const contacts = useWalletStore((s) => s.contacts);
  const transactions = useWalletStore((s) => s.transactions);

  const frequentContacts = contacts.filter((c) => c.frequent).slice(0, 5);
  const recentTransactions = transactions.slice(0, 5);
  const firstName = account.ownerName.split(' ')[0];

  return (
    <div className="flex flex-col gap-6 pb-6 px-5 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-text-muted">Hola,</p>
          <h1 className="text-h2 text-text">{firstName}</h1>
        </div>
        <Avatar name={account.ownerName} size="md" />
      </div>

      <BalanceCard balance={account.balance} />

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

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-text">Contactos frecuentes</h2>
        <div className="flex gap-4 overflow-x-auto -mx-5 px-5 pb-1">
          {frequentContacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              className="flex flex-col items-center gap-2 min-w-[64px]"
              onClick={() => navigate('/transfer')}
            >
              <Avatar name={contact.name} size="lg" />
              <span className="text-caption text-text-muted truncate max-w-[64px]">
                {contact.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-h3 text-text">Movimientos recientes</h2>
          <Link to="/app/activity" className="text-caption text-primary font-medium">
            Ver todo
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <EmptyState title="Aún no tienes movimientos" description="Tus transferencias y pagos aparecerán aquí." />
        ) : (
          // No dividers between rows per the Obsidiana y Lima brief —
          // separation is by vertical spacing only (gap-1, not divide-y).
          <div className="flex flex-col gap-1">
            {recentTransactions.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
