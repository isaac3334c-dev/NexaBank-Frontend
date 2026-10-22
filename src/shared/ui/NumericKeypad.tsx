import { Delete } from 'lucide-react';

export interface NumericKeypadProps {
  onKey: (key: string) => void;
  /** Include the decimal "." key. Defaults to true (amount entry use case). PIN entry must pass false. */
  showDecimal?: boolean;
}

const DIGIT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function NumericKeypad({ onKey, showDecimal = true }: NumericKeypadProps) {
  const keys = showDecimal
    ? [...DIGIT_KEYS.slice(0, 9), '.', DIGIT_KEYS[9], 'back']
    : [...DIGIT_KEYS.slice(0, 9), '', DIGIT_KEYS[9], 'back'];

  return (
    <div className="grid grid-cols-3 gap-3 pb-4">
      {keys.map((key, i) =>
        key === '' ? (
          <span key={`spacer-${i}`} aria-hidden="true" />
        ) : (
          <button
            key={key}
            type="button"
            className="h-14 rounded-[var(--radius-pill)] bg-surface-2 text-h3 text-text flex items-center justify-center min-h-[44px] transition-transform duration-150 active:scale-[0.97]"
            onClick={() => onKey(key)}
            aria-label={key === 'back' ? 'Borrar' : key}
          >
            {key === 'back' ? <Delete className="size-5" /> : key}
          </button>
        ),
      )}
    </div>
  );
}
