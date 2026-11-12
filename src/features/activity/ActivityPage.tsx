import type { ComponentType } from 'react';
import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CreditCard,
  Landmark,
  QrCode,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AppHeader } from '@/shared/ui/AppHeader';
import { EmptyState, ErrorState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Button } from '@/shared/ui/Button';
import { useNotificationsQuery, useInvalidateNotifications, type NotificationResponse } from '@/shared/lib/queries';
import { activityApi } from './activityApi';

// The backend's `type` field is a free-form string set at the call site
// (see TopupService/QrService/TransferService/CardService/WithdrawalService
// notify() calls) rather than an enum — this maps the known prefixes to an
// icon, falling back to a generic bell for any future/unmapped type so a
// new backend notification type never renders broken instead of just generic.
const TYPE_ICON: Array<[string, ComponentType<{ className?: string }>]> = [
  ['TRANSFER_SENT', ArrowUpRight],
  ['TRANSFER_RECEIVED', ArrowDownLeft],
  ['TOPUP', Wallet],
  ['WITHDRAWAL', Landmark],
  ['QR_PAYMENT', QrCode],
  ['CARD', CreditCard],
  ['PAYMENT_REQUEST', ArrowDownLeft],
];

function iconFor(type: string): ComponentType<{ className?: string }> {
  return TYPE_ICON.find(([prefix]) => type.startsWith(prefix))?.[1] ?? Bell;
}

export function ActivityPage() {
  const query = useNotificationsQuery();
  const invalidateNotifications = useInvalidateNotifications();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const notifications = query.data?.pages.flatMap((p) => p.data) ?? [];

  async function handleTap(notification: NotificationResponse) {
    if (notification.read || markingId) return;
    setMarkingId(notification.id);
    try {
      await activityApi.markAsRead(notification.id);
      invalidateNotifications();
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title="Actividad" />
      <div className="flex-1 px-5 pb-6">
        {query.isLoading ? (
          <Skeleton variant="list" rows={6} className="pt-2" />
        ) : query.isError ? (
          <ErrorState description="No pudimos cargar tus notificaciones." action={{ label: 'Reintentar', onClick: () => query.refetch() }} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Sin notificaciones" description="Tu actividad reciente aparecerá aquí." />
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                pending={markingId === notification.id}
                onTap={() => handleTap(notification)}
              />
            ))}

            {query.hasNextPage && (
              <Button
                variant="secondary"
                size="sm"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
                className="self-center mt-4"
              >
                Cargar más
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  notification,
  pending,
  onTap,
}: {
  notification: NotificationResponse;
  pending: boolean;
  onTap: () => void;
}) {
  const Icon = iconFor(notification.type);

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={notification.read}
      className="flex items-start gap-3 py-3 text-left disabled:cursor-default"
    >
      <span
        className="flex items-center justify-center size-11 rounded-full shrink-0"
        style={{
          backgroundColor: notification.read ? 'var(--color-surface-2)' : 'var(--color-primary-soft)',
          color: notification.read ? 'var(--color-text-muted)' : 'var(--color-primary)',
        }}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>

      <div className="flex-1 min-w-0">
        <p className={notification.read ? 'text-body-strong text-text-muted' : 'text-body-strong text-text'}>
          {notification.title}
        </p>
        <p className="text-caption text-text-muted truncate">{notification.body}</p>
        <p className="text-caption text-text-muted mt-0.5">
          {format(new Date(notification.createdAt), "d MMM, HH:mm", { locale: es })}
        </p>
      </div>

      {!notification.read && (
        <span
          aria-label="No leída"
          className="size-2.5 rounded-full bg-primary shrink-0 mt-1.5"
          style={{ opacity: pending ? 0.4 : 1 }}
        />
      )}
    </button>
  );
}
