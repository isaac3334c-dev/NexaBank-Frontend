import { useState } from 'react';
import { CreditCard, Lock, Plus, ShieldOff, Trash2, Unlock } from 'lucide-react';
import { AppHeader } from '@/shared/ui/AppHeader';
import { EmptyState, ErrorState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Badge } from '@/shared/ui/Badge';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Input } from '@/shared/ui/Input';
import { PinConfirmSheet } from '@/shared/ui/PinConfirmSheet';
import { useCardsQuery, useInvalidateCards, useWalletQuery, type CardResponse } from '@/shared/lib/queries';
import { getErrorMessage } from '@/shared/lib/api';
import { formatMoney } from '@/shared/lib/money';
import { cardsApi } from './cardsApi';

const BRAND_LABEL: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMEX: 'American Express',
};

export function CardsPage() {
  const cardsQuery = useCardsQuery();
  const walletQuery = useWalletQuery();
  const invalidateCards = useInvalidateCards();

  const [issueOpen, setIssueOpen] = useState(false);
  const [issuePinOpen, setIssuePinOpen] = useState(false);

  const [limitsCard, setLimitsCard] = useState<CardResponse | null>(null);
  const [cancelCard, setCancelCard] = useState<CardResponse | null>(null);
  const [cancelPinOpen, setCancelPinOpen] = useState(false);

  const account = walletQuery.data?.[0];
  const cards = cardsQuery.data ?? [];

  // Thrown errors propagate back up to PinConfirmSheet, which keeps itself
  // open and renders getErrorMessage(err) inline near the keypad — so these
  // handlers don't need their own error state, just re-throw on failure.
  async function handleIssueConfirmed(confirmationToken: string) {
    if (!account) return;
    await cardsApi.issue({ accountId: account.id }, confirmationToken);
    invalidateCards();
    setIssuePinOpen(false);
    setIssueOpen(false);
  }

  async function handleToggleBlock(card: CardResponse) {
    const nextStatus = card.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    try {
      await cardsApi.update(card.id, { status: nextStatus });
      invalidateCards();
    } catch (err) {
      // Surfaced via a lightweight inline alert rather than a toast system
      // (none exists in this codebase yet) — consistent with how other
      // flows (ConfirmStep) show errors as text near the action.
      window.alert(getErrorMessage(err));
    }
  }

  async function handleCancelConfirmed(confirmationToken: string) {
    if (!cancelCard) return;
    await cardsApi.cancel(cancelCard.id, confirmationToken);
    invalidateCards();
    setCancelPinOpen(false);
    setCancelCard(null);
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader
        title="Tarjetas"
        rightAction={
          <IconButton
            variant="ghost"
            size="sm"
            icon={<Plus className="size-5" />}
            aria-label="Emitir tarjeta"
            onClick={() => setIssueOpen(true)}
          />
        }
      />

      <div className="flex-1 px-5 pb-6 flex flex-col gap-3">
        {cardsQuery.isLoading ? (
          <Skeleton variant="card" className="h-44" />
        ) : cardsQuery.isError ? (
          <ErrorState description="No pudimos cargar tus tarjetas." action={{ label: 'Reintentar', onClick: () => cardsQuery.refetch() }} />
        ) : cards.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Aún no tienes tarjetas"
            description="Emite una tarjeta virtual para pagar desde tu cuenta."
            action={{ label: 'Emitir tarjeta', onClick: () => setIssueOpen(true) }}
          />
        ) : (
          cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onToggleBlock={() => handleToggleBlock(card)}
              onLimits={() => setLimitsCard(card)}
              onCancel={() => setCancelCard(card)}
            />
          ))
        )}
      </div>

      <BottomSheet open={issueOpen} onOpenChange={setIssueOpen} title="Emitir tarjeta">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-body text-text-muted">
            Se emitirá una tarjeta virtual asociada a tu cuenta{account ? ` ${account.name}` : ''}, con los
            límites por defecto del banco.
          </p>
          <Button size="lg" fullWidth disabled={!account} onClick={() => setIssuePinOpen(true)}>
            Continuar
          </Button>
        </div>
      </BottomSheet>

      <PinConfirmSheet
        open={issuePinOpen}
        onOpenChange={setIssuePinOpen}
        title="Confirma la emisión"
        description="Ingresa tu PIN para emitir la tarjeta"
        onConfirmed={handleIssueConfirmed}
      />

      <CardLimitsSheet card={limitsCard} onClose={() => setLimitsCard(null)} onSaved={invalidateCards} />

      <BottomSheet
        open={!!cancelCard}
        onOpenChange={(open) => !open && setCancelCard(null)}
        title="Cancelar tarjeta"
      >
        {cancelCard && (
          <div className="flex flex-col gap-4 pb-2">
            <p className="text-body text-text-muted">
              Esta acción es permanente. La tarjeta terminada en {cancelCard.last4} dejará de funcionar.
            </p>
            <Button variant="danger" size="lg" fullWidth onClick={() => setCancelPinOpen(true)}>
              Cancelar tarjeta
            </Button>
          </div>
        )}
      </BottomSheet>

      <PinConfirmSheet
        open={cancelPinOpen}
        onOpenChange={setCancelPinOpen}
        title="Confirma la cancelación"
        description="Ingresa tu PIN para cancelar la tarjeta"
        onConfirmed={handleCancelConfirmed}
      />
    </div>
  );
}

function CardTile({
  card,
  onToggleBlock,
  onLimits,
  onCancel,
}: {
  card: CardResponse;
  onToggleBlock: () => void;
  onLimits: () => void;
  onCancel: () => void;
}) {
  const blocked = card.status === 'BLOCKED';
  const cancelled = card.status === 'CANCELLED';

  return (
    <Card variant="outlined" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center size-11 rounded-full bg-surface-2 text-text" aria-hidden="true">
            <CreditCard className="size-5" />
          </span>
          <div>
            <p className="text-body-strong text-text">
              {BRAND_LABEL[card.brand] ?? card.brand} •••• {card.last4}
            </p>
            <p className="text-caption text-text-muted">
              Vence {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
            </p>
          </div>
        </div>
        <Badge variant={cancelled ? 'danger' : blocked ? 'warning' : 'success'}>
          {cancelled ? 'Cancelada' : blocked ? 'Bloqueada' : 'Activa'}
        </Badge>
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-center justify-between text-caption text-text-muted">
        <span>Límite diario: {formatMoney({ amount: String(card.dailyLimit), currency: 'PEN' })}</span>
        <span>Mensual: {formatMoney({ amount: String(card.monthlyLimit), currency: 'PEN' })}</span>
      </div>

      {!cancelled && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={blocked ? <Unlock className="size-4" /> : <Lock className="size-4" />} onClick={onToggleBlock}>
            {blocked ? 'Desbloquear' : 'Bloquear'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onLimits}>
            Límites
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Trash2 className="size-4" />} onClick={onCancel} className="text-danger">
            Cancelar
          </Button>
        </div>
      )}
      {cancelled && (
        <div className="flex items-center gap-2 text-caption text-text-muted">
          <ShieldOff className="size-4" aria-hidden="true" />
          Esta tarjeta ya no está disponible.
        </div>
      )}
    </Card>
  );
}

function CardLimitsSheet({
  card,
  onClose,
  onSaved,
}: {
  card: CardResponse | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the local draft whenever a different card opens; avoids a
  // useEffect by deriving from a key-less sheet that just resets via the
  // `card` prop reference each time it's reopened.
  if (card && dailyLimit === '' && monthlyLimit === '' && !saving) {
    setDailyLimit(String(card.dailyLimit));
    setMonthlyLimit(String(card.monthlyLimit));
  }

  function handleClose() {
    setDailyLimit('');
    setMonthlyLimit('');
    setError(null);
    onClose();
  }

  async function handleSave() {
    if (!card) return;
    setSaving(true);
    setError(null);
    try {
      await cardsApi.update(card.id, {
        dailyLimit: Number(dailyLimit),
        monthlyLimit: Number(monthlyLimit),
      });
      onSaved();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={!!card} onOpenChange={(open) => !open && handleClose()} title="Límites de la tarjeta">
      {card && (
        <div className="flex flex-col gap-4 pb-2">
          <Input
            label="Límite diario"
            inputMode="decimal"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value.replace(/[^0-9.]/g, ''))}
          />
          <Input
            label="Límite mensual"
            inputMode="decimal"
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value.replace(/[^0-9.]/g, ''))}
          />
          {error && <p className="text-caption text-danger">{error}</p>}
          <Button size="lg" fullWidth loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
