import { useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, Phone, Search } from 'lucide-react';
import { useTransferFlowStore } from '../transferStore';
import { transferApi } from '../transferApi';
import { getErrorMessage } from '@/shared/lib/api';
import { Button } from '@/shared/ui/Button';
import { CountryPickerSheet } from '@/features/auth/CountryPickerSheet';
import { DEFAULT_COUNTRY, type Country } from '@/shared/lib/countries';
import { formatE123National, toE164 } from '@/shared/lib/phoneFormat';

// There is no "contacts list" endpoint for P2P transfers — /beneficiaries
// is a different domain (international SWIFT/IBAN payees). The backend's
// own UserService.lookupByPhone() comment is explicit about this: resolving
// a transfer recipient means looking them up by phone, one at a time.
export function ContactStep() {
  const setRecipient = useTransferFlowStore((s) => s.setRecipient);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localNumber, setLocalNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = localNumber.replace(/\D/g, '');
  const canSearch = digits.length >= 7 && digits.length <= 12;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    const phone = toE164(country.dialCode, digits);
    setLoading(true);
    setError(null);
    try {
      const recipient = await transferApi.lookupRecipient(phone);
      setRecipient({ accountId: recipient.accountId, displayName: recipient.displayName, phone });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <p className="text-body text-text-muted">Ingresa el teléfono del destinatario registrado en NexaBank.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 h-12 transition-colors duration-200 focus-within:border-primary">
          <span className="text-text-muted shrink-0">
            <Phone className="size-5" />
          </span>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1 text-text text-[16px] shrink-0 -my-2 py-2"
            aria-label={`País: ${country.name}, código +${country.dialCode}. Cambiar`}
          >
            <span aria-hidden="true">{country.flag}</span>
            <span>+{country.dialCode}</span>
            <ChevronDown className="size-4 text-text-muted" aria-hidden="true" />
          </button>
          <span className="h-6 w-px bg-border shrink-0" aria-hidden="true" />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="987 654 321"
            value={localNumber}
            onChange={(e) => setLocalNumber(formatE123National(e.target.value.replace(/\D/g, '').slice(0, 12)))}
            className="flex-1 min-w-0 bg-transparent text-text placeholder:text-text-muted outline-none text-[16px]"
            aria-label="Teléfono del destinatario"
          />
        </div>

        {error && <p className="text-caption text-danger">{error}</p>}

        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!canSearch} leftIcon={<Search className="size-4" />}>
          Buscar
        </Button>
      </form>

      <CountryPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} onSelect={setCountry} />
    </div>
  );
}
