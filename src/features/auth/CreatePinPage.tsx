import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { useAuthStore, DEMO_PHONE } from '@/shared/store/authStore';

const PIN_LENGTH = 4;

export function CreatePinPage() {
  const navigate = useNavigate();
  const phone = useAuthStore((s) => s.phone) ?? DEMO_PHONE;
  const setPin = useAuthStore((s) => s.setPin);

  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const title = stage === 'enter' ? 'Crea tu PIN' : 'Confirma tu PIN';
  const subtitle =
    stage === 'enter'
      ? 'Usarás este PIN de 4 dígitos para desbloquear tu billetera'
      : 'Ingresa el mismo PIN nuevamente';

  function handleKey(key: string) {
    if (key === 'back') {
      setPinValue((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPinValue(next);

    if (next.length === PIN_LENGTH) {
      if (stage === 'enter') {
        setFirstPin(next);
        window.setTimeout(() => {
          setStage('confirm');
          setPinValue('');
        }, 150);
      } else {
        if (next === firstPin) {
          setPin(phone, next);
          navigate('/app/home');
        } else {
          setError(true);
          setShake(true);
          window.setTimeout(() => {
            setShake(false);
            setStage('enter');
            setFirstPin('');
            setPinValue('');
          }, 400);
        }
      }
    }
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      <div className="flex flex-col gap-2 mb-10 items-center text-center">
        <h1 className="text-h1 text-text">{title}</h1>
        <p className="text-body text-text-muted">{subtitle}</p>
      </div>

      <div className={`flex items-center justify-center gap-4 mb-10 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`size-4 rounded-full ${i < pin.length ? 'bg-primary' : 'bg-surface-2 border border-border'}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-caption text-danger text-center mb-4">
          Los PIN no coinciden. Intenta de nuevo.
        </p>
      )}

      <div className="mt-auto">
        <NumericKeypad onKey={handleKey} showDecimal={false} />
      </div>
    </div>
  );
}
