import type { ComponentType } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  QrCode,
  CreditCard,
  Receipt,
  Undo2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Transaction, TransactionType } from '@/shared/types/domain';
import { formatSignedMoney } from '@/shared/lib/money';
import { Badge } from './Badge';

const TYPE_META: Record<
  TransactionType,
  { icon: ComponentType<{ className?: string }>; direction: 'in' | 'out'; label: string }
> = {
  TRANSFER_IN: { icon: ArrowDownLeft, direction: 'in', label: 'Transferencia recibida' },
  TRANSFER_OUT: { icon: ArrowUpRight, direction: 'out', label: 'Transferencia enviada' },
  TOPUP: { icon: Wallet, direction: 'in', label: 'Recarga' },
  WITHDRAWAL: { icon: Landmark, direction: 'out', label: 'Retiro' },
  QR_PAYMENT: { icon: QrCode, direction: 'out', label: 'Pago con QR' },
  CARD_PAYMENT: { icon: CreditCard, direction: 'out', label: 'Pago con tarjeta' },
  FEE: { icon: Receipt, direction: 'out', label: 'Comisión' },
  REFUND: { icon: Undo2, direction: 'in', label: 'Reembolso' },
};

const STATUS_META: Record<Transaction['status'], { variant: 'success' | 'warning' | 'danger' | 'info'; label: string } | null> = {
  COMPLETED: null,
  PENDING: { variant: 'warning', label: 'Pendiente' },
  FAILED: { variant: 'danger', label: 'Fallida' },
  REVERSED: { variant: 'info', label: 'Revertida' },
};

export interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const meta = TYPE_META[transaction.type];
  const Icon = meta.icon;
  const status = STATUS_META[transaction.status];
  const title = transaction.counterparty?.name ?? meta.label;
  const subtitle = transaction.counterparty ? meta.label : transaction.description;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="flex items-center justify-center size-11 rounded-full shrink-0"
        style={{
          backgroundColor: meta.direction === 'in' ? 'var(--color-success-soft)' : 'var(--color-surface-2)',
          color: meta.direction === 'in' ? 'var(--color-success)' : 'var(--color-text-muted)',
        }}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-body-strong text-text truncate">{title}</p>
        <p className="text-caption text-text-muted truncate">
          {subtitle}
          {subtitle ? ' · ' : ''}
          {format(new Date(transaction.createdAt), "d MMM, HH:mm", { locale: es })}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="text-body-strong font-tabular"
          style={{
            color: meta.direction === 'in' ? 'var(--color-amount-in)' : 'var(--color-amount-out)',
          }}
        >
          {formatSignedMoney(transaction.amount, meta.direction)}
        </span>
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
      </div>
    </div>
  );
}
