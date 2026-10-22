import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Check } from 'lucide-react';
import { Avatar } from '@/shared/ui/Avatar';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { useAuthStore, DEMO_PHONE, DEMO_NAME } from '@/shared/store/authStore';

const PIN_LENGTH = 4;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function PinPage() {
  const navigate = useNavigate();
  const storePhone = useAuthStore((s) => s.phone);
  const getUser = useAuthStore((s) => s.getUser);
  const verifyPin = useAuthStore((s) => s.verifyPin);
  const forgetDevice = useAuthStore((s) => s.forgetDevice);

  // Fall back to the seeded demo user if no phone is currently set, so this
  // screen is never blank during dev testing (e.g. navigating here directly).
  const phone = storePhone ?? DEMO_PHONE;
  const user = getUser(phone);
  const displayName = user?.name ?? DEMO_NAME;

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [bioState, setBioState] = useState<'idle' | 'scanning' | 'success'>('idle');

  function handleKey(key: string) {
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    setError(false);

    if (next.length === PIN_LENGTH) {
      if (verifyPin(phone, next)) {
        navigate('/app/home');
      } else {
        setError(true);
        setShake(true);
        window.setTimeout(() => {
          setShake(false);
          setPin('');
        }, 400);
      }
    }
  }

  function handleFaceId() {
    if (prefersReducedMotion()) {
      setBioState('success');
      window.setTimeout(() => navigate('/app/home'), 300);
      return;
    }
    setBioState('scanning');
    window.setTimeout(() => {
      setBioState('success');
      window.setTimeout(() => navigate('/app/home'), 400);
    }, 1200);
  }

  function handleChangeNumber() {
    forgetDevice(phone);
    navigate('/auth/phone');
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      <div className="flex flex-col items-center gap-3 mb-10">
        <Avatar name={displayName} size="lg" />
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-h3 text-text">{displayName}</p>
          <p className="text-caption text-text-muted">{phone}</p>
        </div>
      </div>

      <p className="text-body-strong text-text text-center mb-6">Ingresa tu PIN</p>

      <div className={`flex items-center justify-center gap-4 mb-6 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`size-4 rounded-full ${i < pin.length ? 'bg-primary' : 'bg-surface-2 border border-border'}`}
          />
        ))}
      </div>

      {error && <p className="text-caption text-danger text-center mb-4">PIN incorrecto</p>}

      {bioState !== 'idle' && (
        <div className="flex flex-col items-center gap-2 mb-4" aria-live="polite">
          <div
            className={`size-12 rounded-full flex items-center justify-center bg-primary-soft text-primary ${
              bioState === 'scanning' ? 'animate-pulse' : ''
            }`}
          >
            {bioState === 'success' ? <Check className="size-6" /> : <ScanFace className="size-6" />}
          </div>
          <p className="text-caption text-text-muted">
            {bioState === 'scanning' ? 'Verificando rostro…' : 'Identidad verificada'}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-4">
        <button
          type="button"
          onClick={handleFaceId}
          disabled={bioState !== 'idle'}
          className="flex items-center justify-center gap-2 h-12 min-h-[44px] rounded-[var(--radius-pill)] bg-surface-2 text-text font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
        >
          <ScanFace className="size-5" />
          Usar Face ID
        </button>

        <NumericKeypad onKey={handleKey} showDecimal={false} />

        <button
          type="button"
          onClick={handleChangeNumber}
          className="text-caption text-primary font-medium text-center"
        >
          ¿No eres tú? Cambiar número
        </button>
      </div>
    </div>
  );
}
