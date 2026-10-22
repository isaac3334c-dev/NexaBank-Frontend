import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/shared/ui/AppHeader';
import { useTransferFlowStore, type TransferStep } from './transferStore';
import { ContactStep } from './steps/ContactStep';
import { AmountStep } from './steps/AmountStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { ResultStep } from './steps/ResultStep';

const STEP_TITLES: Record<string, string> = {
  contact: 'Enviar dinero',
  amount: 'Monto a enviar',
  confirm: 'Confirmar envío',
  result: '',
};

const STEP_ORDER: TransferStep[] = ['contact', 'amount', 'confirm', 'result'];

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function TransferPage() {
  const navigate = useNavigate();
  const step = useTransferFlowStore((s) => s.step);
  const setStep = useTransferFlowStore((s) => s.setStep);
  const reset = useTransferFlowStore((s) => s.reset);

  // Tracks the previous step index so the slide direction (forward vs back)
  // can be derived — a 200ms horizontal slide + fade keyed by step index,
  // per the Obsidiana y Lima motion brief. CSS transition-duration is
  // neutralized globally under prefers-reduced-motion (src/styles/index.css),
  // so no separate JS branch is required here beyond what that rule covers.
  const prevIndexRef = useRef(STEP_ORDER.indexOf(step));
  const currentIndex = STEP_ORDER.indexOf(step);
  const direction = currentIndex >= prevIndexRef.current ? 1 : -1;

  useEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Reset flow state whenever the transfer route is entered fresh.
  useEffect(() => {
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBack() {
    if (step === 'amount') return setStep('contact');
    if (step === 'confirm') return setStep('amount');
    navigate('/app/home');
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {step !== 'result' && <AppHeader title={STEP_TITLES[step]} onBack={handleBack} />}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <StepSlide key={step} direction={direction}>
          {step === 'contact' && <ContactStep />}
          {step === 'amount' && <AmountStep />}
          {step === 'confirm' && <ConfirmStep />}
          {step === 'result' && <ResultStep />}
        </StepSlide>
      </div>
    </div>
  );
}

function StepSlide({ children, direction }: { children: React.ReactNode; direction: 1 | -1 }) {
  const [entered, setEntered] = useState(prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="flex-1 flex flex-col transition-[transform,opacity] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
      style={{
        transform: entered ? 'translateX(0)' : `translateX(${direction * 16}px)`,
        opacity: entered ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}
