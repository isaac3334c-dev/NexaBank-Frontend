import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { OtpInput } from '@/shared/ui/OtpInput';
import { useAuthStore } from '@/shared/store/authStore';
import { authApi } from '@/features/auth/authApi';
import { getErrorMessage } from '@/shared/lib/api';

const RESEND_SECONDS = 30;

function maskPhone(phone: string): string {
  // Stored phone is now strict E.164 ("+51987654321", no spaces — the
  // backend's validation rejects the grouped E.123 presentation). There's
  // no reliable boundary between dial code and national number without a
  // full numbering-plan lookup, so this masks purely by position instead:
  // keep "+" + first digit of the whole number and the last 3 digits.
  const match = phone.match(/^(\+)(\d+)$/);
  if (!match) return phone;
  const [, plus, digits] = match;
  if (digits.length < 4) return phone;
  const first = digits[0];
  const last3 = digits.slice(-3);
  const maskedLen = Math.max(digits.length - 4, 0);
  return `${plus}${first}${'*'.repeat(maskedLen)}${last3}`;
}

export function OtpPage() {
  const navigate = useNavigate();
  const phone = useAuthStore((s) => s.phone);
  const setUser = useAuthStore((s) => s.setUser);

  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  // Can only land here after PhonePage set a phone via /auth/phone/start —
  // no demo fallback anymore now that this calls the real backend.
  useEffect(() => {
    if (!phone) navigate('/auth/phone', { replace: true });
  }, [phone, navigate]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  function handleChange(value: string) {
    setCode(value);
    setErrorMsg(null);
    if (value.length === 6) {
      verify(value);
    }
  }

  async function verify(value: string) {
    if (!phone) return;
    setVerifying(true);
    try {
      const response = await authApi.verifyPhone(phone, value);
      if (response.requiresRegistration) {
        navigate('/auth/register');
      } else if (response.requiresPin) {
        setUser(response.user);
        navigate('/auth/create-pin');
      } else {
        setUser(response.user);
        navigate('/auth/pin');
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!phone) return;
    setSecondsLeft(RESEND_SECONDS);
    await authApi.startPhone(phone).catch(() => undefined);
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-h1 text-text">Verifica tu número</h1>
        <p className="text-body text-text-muted">
          Enviamos un código de 6 dígitos a{' '}
          <span className="text-text font-medium">{phone ? maskPhone(phone) : ''}</span>
        </p>
      </div>

      <OtpInput value={code} onChange={handleChange} error={Boolean(errorMsg)} className={shake ? 'animate-shake' : ''} />

      {errorMsg && <p className="text-caption text-danger mt-3">{errorMsg}</p>}

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
        loading={verifying}
        disabled={code.length !== 6}
        onClick={() => verify(code)}
        className="mt-auto mb-2"
      >
        Continuar
      </Button>
    </div>
  );
}
