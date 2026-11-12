import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { Skeleton } from '@/shared/ui/Skeleton';
import { ErrorState } from '@/shared/ui/EmptyState';
import { useAuthStore } from '@/shared/store/authStore';
import { useWalletQuery } from '@/shared/lib/queries';

// There is no dedicated "payment request" product surface in this phase —
// POST /api/v1/payment-requests exists on the backend (see
// PaymentRequestController) but building its own request/accept/decline UI
// is a separate feature, not what Receive needs: per the Phase F brief,
// Receive just has to show enough identifying info (phone + account) for
// someone else to complete a P2P transfer via /transfer's existing
// phone-lookup flow. That keeps this screen additive and not a blocker on
// a payment-requests UI shipping later.
export function ReceivePage() {
  const user = useAuthStore((s) => s.user);
  const walletQuery = useWalletQuery();
  const [copied, setCopied] = useState<'phone' | 'account' | null>(null);

  const account = walletQuery.data?.[0];

  async function copy(value: string, which: 'phone' | 'account') {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions) —
      // the tap still "succeeds" visually since there's nothing else this
      // screen can do about it; the value remains visible to copy by hand.
    }
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function share() {
    const text = `Envíame dinero por NexaBank a mi número ${user?.phone ?? ''}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled the share sheet — not an error worth surfacing.
      }
      return;
    }
    await copy(text, 'phone');
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title="Recibir" />

      <div className="flex-1 flex flex-col px-5 pt-4 gap-4">
        <div className="flex flex-col items-center gap-2 py-4">
          <Avatar name={user?.displayName ?? ''} size="lg" />
          <p className="text-h3 text-text">{user?.displayName}</p>
          <p className="text-caption text-text-muted">
            Comparte tu número o cuenta para que te transfieran por NexaBank
          </p>
        </div>

        <Card variant="outlined" className="flex flex-col gap-3">
          <InfoRow
            label="Teléfono"
            value={user?.phone ?? '—'}
            copied={copied === 'phone'}
            onCopy={() => user?.phone && copy(user.phone, 'phone')}
          />
          <div className="h-px bg-border" />
          {walletQuery.isLoading ? (
            <Skeleton variant="text" className="h-5" />
          ) : walletQuery.isError || !account ? (
            <ErrorState description="No pudimos cargar tu cuenta." action={{ label: 'Reintentar', onClick: () => walletQuery.refetch() }} />
          ) : (
            <>
              <InfoRow
                label="Cuenta"
                value={account.id}
                copied={copied === 'account'}
                onCopy={() => copy(account.id, 'account')}
              />
              <div className="h-px bg-border" />
              <InfoRow label="Titular" value={account.name} />
            </>
          )}
        </Card>

        <div className="flex-1" />

        <Button size="lg" fullWidth leftIcon={<Share2 className="size-4" />} onClick={share} className="mb-6">
          Compartir mis datos
        </Button>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-caption text-text-muted">{label}</p>
        <p className="text-body-strong font-tabular text-text truncate">{value}</p>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center justify-center size-9 rounded-full bg-surface-2 text-text-muted shrink-0 min-h-[44px] min-w-[44px] transition-colors duration-200"
          aria-label={`Copiar ${label.toLowerCase()}`}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </button>
      )}
    </div>
  );
}
