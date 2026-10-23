import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Phone } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { LogoGlyph } from '@/shared/ui/LogoGlyph';
import { useAuthStore } from '@/shared/store/authStore';
import { CountryPickerSheet } from '@/features/auth/CountryPickerSheet';
import { DEFAULT_COUNTRY, type Country } from '@/shared/lib/countries';
import { formatE123, formatE123National } from '@/shared/lib/phoneFormat';

export function PhonePage() {
  const navigate = useNavigate();
  const setPhone = useAuthStore((s) => s.setPhone);
  const isRegistered = useAuthStore((s) => s.isRegistered);
  const isDeviceRecognized = useAuthStore((s) => s.isDeviceRecognized);
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localNumber, setLocalNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const digits = localNumber.replace(/\D/g, '');
  const canContinue = digits.length >= 7 && digits.length <= 12;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    setLoading(true);
    // ITU-T E.123 international notation: "+<country code> <national number
    // grouped in 2-3 digit clusters>", e.g. "+51 987 654 321".
    const fullPhone = formatE123(country.dialCode, digits);

    // Mock auth phase: no real backend lookup yet — routing decision is based
    // purely on local authStore state. See docs/DECISIONS.md.
    window.setTimeout(() => {
      setLoading(false);
      setPhone(fullPhone);
      if (isRegistered(fullPhone) && isDeviceRecognized(fullPhone)) {
        navigate('/auth/pin');
      } else {
        navigate('/auth/otp');
      }
    }, 400);
  }

  return (
    <div className="flex flex-col min-h-dvh justify-center py-10">
      {/* Same radial glow recipe as SplashPage, so this screen reads as a
          continuation of the launch animation's background rather than a
          hard cut — "breathing" slowly (opacity+scale) instead of static.
          `fixed inset-0` (not `absolute` relative to this page's own box)
          so it spans the full viewport instead of being capped to
          AuthLayout's 480px column, which was visibly clipping it. */}
      <div
        className="fixed inset-0 pointer-events-none animate-bg-breathe"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center gap-2 mb-10">
        <LogoGlyph size={72} />
        <h1 className="text-h1 text-text mt-2">NexaBank</h1>
        <p className="text-body text-text-muted">Tu billetera digital</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-body-strong text-text">
            Número de celular
          </label>
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
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="987 654 321"
              value={localNumber}
              onChange={(e) => setLocalNumber(formatE123National(e.target.value.replace(/\D/g, '').slice(0, 12)))}
              className="flex-1 min-w-0 bg-transparent text-text placeholder:text-text-muted outline-none text-[16px]"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!canContinue} className="mt-4">
          Continuar
        </Button>
      </form>

      <CountryPickerSheet open={pickerOpen} onOpenChange={setPickerOpen} onSelect={setCountry} />
    </div>
  );
}
