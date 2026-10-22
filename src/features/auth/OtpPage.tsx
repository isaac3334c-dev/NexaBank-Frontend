import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { OtpInput } from '@/shared/ui/OtpInput';
import { useAuthStore, DEMO_PHONE } from '@/shared/store/authStore';

// Mock verification only — no real SMS/backend is involved. Documented in
// docs/DECISIONS.md. This is the one and only "valid" code for every phone.
const DEMO_OTP_CODE = '123456';
const RESEND_SECONDS = 30;

function maskPhone(phone: string): string {
  // "+51 987 654 321" -> "+51 9** *** 456" (keep first digit of first group
  // and last 3 digits, mask the rest).
  const digits = phone.replace(/\D/g, '').slice(2); // strip "51" country code
  if (digits.length < 9) return phone;
  const first = digits[0];
  const last3 = digits.slice(-3);
  return `+51 ${first}** *** ${last3}`;
}

export function OtpPage() {
  const navigate = useNavigate();
  const phone = useAuthStore((s) => s.phone) ?? DEMO_PHONE;
  const isRegistered = useAuthStore((s) => s.isRegistered);
  const isDeviceRecognized = useAuthStore((s) => s.isDeviceRecognized);

  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  function handleChange(value: string) {
    setCode(value);
    setError(false);
    if (value.length === 6) {
      verify(value);
    }
  }

  function verify(value: string) {
    if (value !== DEMO_OTP_CODE) {
      setError(true);
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }

    if (!isRegistered(phone)) {
      navigate('/auth/register');
    } else if (!isDeviceRecognized(phone)) {
      navigate('/auth/create-pin');
    } else {
      navigate('/app/home');
    }
  }

  function handleResend() {
    setSecondsLeft(RESEND_SECONDS);
    // No real resend — this is purely a mock countdown reset.
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-h1 text-text">Verifica tu número</h1>
        <p className="text-body text-text-muted">
          Enviamos un código de 6 dígitos a <span className="text-text font-medium">{maskPhone(phone)}</span>
        </p>
      </div>

      <OtpInput value={code} onChange={handleChange} error={error} className={shake ? 'animate-shake' : ''} />

      {error && <p className="text-caption text-danger mt-3">Código incorrecto. Inténtalo de nuevo.</p>}

      <div className="mt-6">
        {secondsLeft > 0 ? (
          <p className="text-caption text-text-muted">Reenviar código en {secondsLeft}s</p>
        ) : (
          <button type="button" className="text-caption text-primary font-medium" onClick={handleResend}>
            Reenviar código
          </button>
        )}
      </div>

      <Button
        size="lg"
        fullWidth
        disabled={code.length !== 6}
        onClick={() => verify(code)}
        className="mt-auto mb-2"
      >
        Continuar
      </Button>
    </div>
  );
}
