import { cn } from '@/shared/lib/cn';

export interface MoneyDisplayProps {
  /** Already-formatted money string, e.g. the output of formatMoney(). */
  formatted: string;
  className?: string;
  /** Applied to the whole-part + currency-symbol/prefix span. */
  wholeClassName?: string;
  /** Applied to the decimal (fraction) span, including its separator. */
  decimalClassName?: string;
}

/**
 * Splits an already-locale-formatted money string into a large "whole"
 * part and a smaller, muted "decimal" part, for the two-tier balance
 * treatment used by BalanceCard and the transfer AmountStep.
 *
 * Deliberately does NOT re-derive formatting or assume a locale/separator
 * convention — it operates on whatever formatMoney() already produced and
 * finds the LAST occurrence of "." or "," followed by exactly 1-2 trailing
 * digits (the fraction group), since different locales use either
 * character as the decimal mark (e.g. es-PE/en-US use ".", es-ES by
 * Intl.NumberFormat with currency "EUR" uses ","). If no such pattern is
 * found (e.g. a hidden-balance placeholder like "••••••"), the whole
 * string is rendered as the "whole" part unsplit.
 */
export function MoneyDisplay({ formatted, className, wholeClassName, decimalClassName }: MoneyDisplayProps) {
  const match = formatted.match(/^(.*[.,])(\d{1,2})$/);

  if (!match) {
    return <span className={cn(wholeClassName, className)}>{formatted}</span>;
  }

  const [, wholeWithSeparator, decimals] = match;

  return (
    <span className={className}>
      <span className={wholeClassName}>{wholeWithSeparator}</span>
      <span className={decimalClassName}>{decimals}</span>
    </span>
  );
}
