import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { COUNTRIES, type Country } from '@/shared/lib/countries';

export interface CountryPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (country: Country) => void;
}

// Searchable list of ITU-T E.123 dial codes, used by PhonePage to let a
// user switch the country/prefix the phone number is entered under.
export function CountryPickerSheet({ open, onOpenChange, onSelect }: CountryPickerSheetProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q.replace('+', '')),
    );
  }, [query]);

  function handleSelect(country: Country) {
    onSelect(country);
    setQuery('');
    onOpenChange(false);
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Elige tu país">
      <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 h-11 mb-3">
        <Search className="size-4 text-text-muted shrink-0" aria-hidden="true" />
        <input
          type="text"
          inputMode="search"
          aria-label="Buscar país o código"
          autoFocus
          placeholder="Buscar país o código"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-text placeholder:text-text-muted outline-none text-[16px]"
        />
      </label>

      <div className="max-h-[50vh] overflow-y-auto -mx-5 px-5">
        {results.length === 0 ? (
          <p className="text-caption text-text-muted text-center py-6">Sin resultados</p>
        ) : (
          results.map((country) => (
            <button
              key={country.iso2}
              type="button"
              onClick={() => handleSelect(country)}
              className="flex w-full items-center gap-3 h-12 min-h-[44px] text-left rounded-[var(--radius-md)] px-2 -mx-2 active:bg-surface-2"
            >
              <span className="text-h3 leading-none" aria-hidden="true">
                {country.flag}
              </span>
              <span className="flex-1 text-body text-text">{country.name}</span>
              <span className="text-body text-text-muted tabular-nums">+{country.dialCode}</span>
            </button>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
