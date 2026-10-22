import { useState } from 'react';
import { useWalletStore } from '@/shared/store/walletStore';
import { useTransferFlowStore } from '../transferStore';
import { formatMoney } from '@/shared/lib/money';
import { TRANSFER_FEE } from '@/shared/types/mockData';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';

export function ConfirmStep() {
  const account = useWalletStore((s) => s.account);
  const completeTransfer = useWalletStore((s) => s.completeTransfer);
  const contact = useTransferFlowStore((s) => s.contact);
  const amount = useTransferFlowStore((s) => s.amount);
  const setStep = useTransferFlowStore((s) => s.setStep);
  const [loading, setLoading] = useState(false);

  if (!contact) return null;

  const selectedContact = contact;
  const currency = account.balance.currency;
  const fee = TRANSFER_FEE.amount;
  const total = (Number(amount) + Number(fee)).toFixed(2);
  const resultingBalance = (Number(account.balance.amount) - Number(total)).toFixed(2);

  function handleConfirm() {
    setLoading(true);
    window.setTimeout(() => {
      completeTransfer({ contact: selectedContact, amount, fee });
      setLoading(false);
      setStep('result');
    }, 700);
  }

  return (
    <div className="flex flex-col h-full px-5 pt-4">
      <div className="flex flex-col items-center gap-2 mb-6">
        <Avatar name={contact.name} size="lg" />
        <p className="text-body-strong text-text">{contact.name}</p>
        <p className="text-caption text-text-muted">{contact.identifier}</p>
      </div>

      <Card variant="outlined" className="flex flex-col gap-3">
        <Row label="Monto" value={formatMoney({ amount, currency })} />
        <Row label="Comisión" value={formatMoney({ amount: fee, currency })} />
        <div className="h-px bg-border" />
        <Row label="Total a enviar" value={formatMoney({ amount: total, currency })} strong />
        <Row label="Saldo resultante" value={formatMoney({ amount: resultingBalance, currency })} muted />
      </Card>

      <div className="flex-1" />

      <Button size="lg" fullWidth loading={loading} onClick={handleConfirm} className="mb-2">
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
