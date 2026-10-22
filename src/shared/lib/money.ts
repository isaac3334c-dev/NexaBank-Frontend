// Money handling constraint (read before touching this file):
//
// Money amounts are stored and passed around as STRINGS (see Money type in
// shared/types/domain.ts), never as floats. JavaScript's binary floating
// point cannot represent many base-10 decimal fractions exactly (0.1 + 0.2
// !== 0.3), which is unacceptable for currency. We only convert a money
// string to a Number at the final formatting boundary (this file), strictly
// for *display*. Any arithmetic on money (summing, subtracting a fee, etc.)
// in this codebase must be done with a decimal-safe approach — for this
// mock phase amounts are small and pre-validated, so we use Number() at the
// point of calculation in store actions, but this is a known simplification
// documented in docs/DECISIONS.md. Do NOT spread this pattern into real
// money-moving code against a live API without a proper decimal library.

const CURRENCY_LOCALE: Record<string, string> = {
  PEN: 'es-PE',
  USD: 'en-US',
  EUR: 'es-ES',
};

function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALE[currency] ?? 'es-PE';
}

/**
 * Formats a Money value for display using Intl.NumberFormat.
 * Never concatenate currency symbols manually — locale-aware formatting
 * handles symbol position, grouping separators, and decimal marks.
 */
export function formatMoney(money: { amount: string; currency: string }): string {
  const value = Number(money.amount);
  const locale = localeForCurrency(money.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a Money value with an explicit sign prefix for transaction lists.
 * Color communicates direction too (see TransactionItem), but the sign
 * character must always be present — never rely on color alone (WCAG).
 */
export function formatSignedMoney(
  money: { amount: string; currency: string },
  direction: 'in' | 'out',
): string {
  const formatted = formatMoney(money);
  return direction === 'in' ? `+${formatted}` : `−${formatted}`;
}

/**
 * Parses a user-entered amount string (from the on-screen keypad) into a
 * normalized decimal string. Keeps everything as a string end-to-end;
 * only used for mock keypad input assembly, not for storage precision math.
 */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join('').slice(0, 2)}`;
}

export function isAmountWithinBalance(amount: string, balance: string): boolean {
  return Number(amount) > 0 && Number(amount) <= Number(balance);
}
