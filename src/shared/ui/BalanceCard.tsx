import { Eye, EyeOff } from 'lucide-react';
import { useUiStore } from '@/shared/store/uiStore';
import { formatMoney } from '@/shared/lib/money';
import { useCountUp } from '@/shared/lib/useCountUp';
import type { Money } from '@/shared/types/domain';
import { IconButton } from './IconButton';
import { MoneyDisplay } from './MoneyDisplay';

// Subtle fractal-noise texture overlay (~3% opacity, baked into the SVG's
// own alpha channel via feColorMatrix rather than a separate CSS opacity,
// so the technique is self-contained to this one background-image).
// See docs/DECISIONS.md "Obsidiana y Lima redesign" for the approach.
const NOISE_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Mocked pending real transaction-history-based computation — there is no
// historical balance series to derive this from yet. See docs/DECISIONS.md.
const MOCK_MONTHLY_VARIATION_PCT = 12;

export interface BalanceCardProps {
  balance: Money;
  label?: string;
  /** Skip the mount count-up animation (e.g. when re-rendering, not mounting). */
  animateOnMount?: boolean;
}

export function BalanceCard({ balance, label = 'Saldo disponible', animateOnMount = true }: BalanceCardProps) {
  const isHidden = useUiStore((s) => s.isBalanceHidden);
  const toggle = useUiStore((s) => s.toggleBalanceHidden);

  const numericBalance = Number(balance.amount);
  const animatedValue = useCountUp(animateOnMount ? numericBalance : numericBalance);
  const displayAmount = isHidden
    ? null
    : formatMoney({ amount: animatedValue.toFixed(2), currency: balance.currency });

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-card)] p-5 text-text"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid rgba(198,244,50,.25)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: NOISE_TEXTURE }}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between">
        <span className="overline text-text-muted">{label.toUpperCase()}</span>
        <IconButton
          variant="on-surface"
          size="sm"
          icon={isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          aria-label={isHidden ? 'Mostrar saldo' : 'Ocultar saldo'}
          onClick={toggle}
        />
      </div>

      <p className="relative mt-3">
        {isHidden ? (
          <span
            className="font-tabular text-text"
            style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em' }}
          >
            ••••••
          </span>
        ) : (
          <MoneyDisplay
            formatted={displayAmount ?? ''}
            className="inline-flex items-baseline"
            wholeClassName="font-tabular text-text text-[44px] font-semibold tracking-[-0.02em]"
            decimalClassName="font-tabular text-text-muted text-[26.4px] font-semibold tracking-[-0.02em]"
          />
        )}
      </p>

      <div className="relative mt-1 flex items-center justify-between">
        <span className="text-caption text-text-muted">{balance.currency}</span>
        <span className="text-caption font-medium" style={{ color: 'var(--color-primary)' }}>
          +{MOCK_MONTHLY_VARIATION_PCT}% este mes
        </span>
      </div>
    </div>
  );
}
