import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { useAuthStore } from '@/shared/store/authStore';

export function PhonePage() {
  const navigate = useNavigate();
  const setPhone = useAuthStore((s) => s.setPhone);
  const isRegistered = useAuthStore((s) => s.isRegistered);
  const isDeviceRecognized = useAuthStore((s) => s.isDeviceRecognized);
  const [localNumber, setLocalNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const canContinue = localNumber.replace(/\D/g, '').length === 9;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    setLoading(true);
    const fullPhone = `+51 ${localNumber.trim()}`;

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
      <div className="flex flex-col items-center gap-2 mb-10">
        <div
          className="size-14 rounded-[var(--radius-lg)] flex items-center justify-center bg-primary text-on-primary font-bold text-h2"
          aria-hidden="true"
        >
          N
        </div>
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
            <span className="text-text text-[16px] shrink-0">+51</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="987 654 321"
              value={localNumber}
              onChange={(e) => setLocalNumber(e.target.value.replace(/[^\d\s]/g, ''))}
              className="flex-1 min-w-0 bg-transparent text-text placeholder:text-text-muted outline-none text-[16px]"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!canContinue} className="mt-4">
          Continuar
        </Button>
      </form>
    </div>
  );
}
