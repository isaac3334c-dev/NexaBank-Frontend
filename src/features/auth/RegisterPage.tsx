import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User, Globe2, KeyRound, ArrowLeftRight, CreditCard, Wallet } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { StepSlide } from '@/shared/ui/StepSlide';
import { NexaMascot, type NexaState, type NexaLookAt } from '@/shared/ui/NexaMascot';
import { useAuthStore, DEMO_PHONE } from '@/shared/store/authStore';

interface TourSlide {
  nexaState: NexaState;
  icon?: ReactNode;
  headline: string;
  body: string;
  buttonLabel: string;
}

// Steps 0-5: the benefit tour. Step 6 (the form) is handled separately below
// since its layout/composition differs from the other slides (shrunk Nexa
// badge + form fields instead of hero Nexa + icon).
const TOUR_SLIDES: TourSlide[] = [
  {
    nexaState: 'wave',
    headline: '¡Hola! Soy Nexa 👋',
    body: 'Tu guía en NexaBank. Antes de crear tu cuenta, déjame mostrarte por qué miles de personas ya manejan su dinero con nosotros.',
    buttonLabel: 'Vamos',
  },
  {
    nexaState: 'excited',
    icon: <Globe2 className="size-7" />,
    headline: 'Envía dinero sin fronteras, sin comisiones',
    body: 'Transferencias internacionales sin comisión ni IVA. Lo que envías es lo que llega.',
    buttonLabel: 'Siguiente',
  },
  {
    nexaState: 'idle',
    icon: <KeyRound className="size-7" />,
    headline: 'Una llave en vez de 20 dígitos',
    body: 'Envía y recibe dinero al instante usando solo un alias — rápido, simple, sin errores de digitación.',
    buttonLabel: 'Siguiente',
  },
  {
    nexaState: 'idle',
    icon: <ArrowLeftRight className="size-7" />,
    headline: 'Cambia divisas a la tasa real',
    body: 'Convierte entre monedas con nuestra calculadora integrada, sin sorpresas en el tipo de cambio.',
    buttonLabel: 'Siguiente',
  },
  {
    nexaState: 'idle',
    icon: <CreditCard className="size-7" />,
    headline: 'Tu tarjeta virtual, lista en segundos',
    body: 'Crea una tarjeta virtual al instante y empieza a comprar en línea de forma segura.',
    buttonLabel: 'Siguiente',
  },
  {
    nexaState: 'excited',
    icon: <Wallet className="size-7" />,
    headline: 'Organiza tu dinero en Voids',
    body: 'Crea espacios separados para tus metas, ahorros o gastos — como bolsillos dentro de tu cuenta.',
    buttonLabel: 'Comenzar mi registro',
  },
];

const FORM_STEP = TOUR_SLIDES.length; // 6

// Deliberately simple — just enough to catch obviously malformed addresses
// typed into an optional field, not full RFC 5322 validation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const phone = useAuthStore((s) => s.phone) ?? DEMO_PHONE;
  const register = useAuthStore((s) => s.register);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'email' | null>(null);

  const prevStepRef = useRef(step);
  const direction = step >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);

  const emailTrimmed = email.trim();
  const emailValid = emailTrimmed.length === 0 || EMAIL_PATTERN.test(emailTrimmed);
  const canContinue = name.trim().length > 0 && emailValid;
  const onFormStep = step === FORM_STEP;

  // One-shot "ready" gesture: fires only on the false -> true transition of
  // canContinue, not on every re-render while the form stays valid.
  const [nexaReady, setNexaReady] = useState(false);
  const prevCanContinueRef = useRef(canContinue);
  useEffect(() => {
    if (canContinue && !prevCanContinueRef.current) {
      setNexaReady(true);
    } else if (!canContinue) {
      setNexaReady(false);
    }
    prevCanContinueRef.current = canContinue;
  }, [canContinue]);

  const lookAt = focusedField === 'name' ? 'left' : focusedField === 'email' ? 'right' : 'neutral';

  function goNext() {
    setStep((s) => Math.min(s + 1, FORM_STEP));
  }

  function handleSkip() {
    setStep(FORM_STEP);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    register(phone, { name: name.trim(), email: emailTrimmed || undefined });
    navigate('/auth/loading');
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      {!onFormStep && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={handleSkip}
            className="text-body-strong text-text-muted px-2 py-1 -mr-2 rounded-[var(--radius-sm)] hover:text-text transition-colors duration-200"
          >
            Saltar
          </button>
        </div>
      )}

      {!onFormStep && (
        <div className="flex items-center justify-center gap-1.5 mb-6" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOUR_SLIDES.length}>
          {TOUR_SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-[var(--radius-pill)] transition-[width,background-color] duration-200"
              style={{
                width: i === step ? 20 : 6,
                backgroundColor: i === step ? 'var(--color-primary)' : 'var(--color-border)',
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      <div className="relative flex-1 flex flex-col overflow-hidden">
        {!onFormStep ? (
          <StepSlide key={step} direction={direction} className="flex-1 flex flex-col transition-[transform,opacity] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none">
            <TourSlideView slide={TOUR_SLIDES[step]} onNext={goNext} />
          </StepSlide>
        ) : (
          <StepSlide
            key={step}
            direction={direction}
            className="flex-1 flex flex-col transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          >
            <FormStepView
              phone={phone}
              name={name}
              email={email}
              emailValid={emailValid}
              canContinue={canContinue}
              nexaReady={nexaReady}
              lookAt={lookAt}
              onNameChange={setName}
              onEmailChange={setEmail}
              onFocusField={setFocusedField}
              onSubmit={handleSubmit}
            />
          </StepSlide>
        )}
      </div>
    </div>
  );
}

function TourSlideView({ slide, onNext }: { slide: TourSlide; onNext: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center px-2">
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <NexaMascot state={slide.nexaState} />

        {slide.icon && (
          <span
            className="flex items-center justify-center size-14 rounded-[var(--radius-card)]"
            style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
            aria-hidden="true"
          >
            {slide.icon}
          </span>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text">{slide.headline}</h1>
          <p className="text-body text-text-muted">{slide.body}</p>
        </div>
      </div>

      <Button size="lg" fullWidth onClick={onNext} className="mt-6">
        {slide.buttonLabel}
      </Button>
    </div>
  );
}

interface FormStepViewProps {
  phone: string;
  name: string;
  email: string;
  emailValid: boolean;
  canContinue: boolean;
  nexaReady: boolean;
  lookAt: NexaLookAt;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onFocusField: (field: 'name' | 'email' | null) => void;
  onSubmit: (e: FormEvent) => void;
}

// Form step (step 6): top portion is the headline + compact form fields,
// bottom roughly-half of the viewport is hero-sized Nexa composed directly
// behind/above the submit button so the whole thing reads as Nexa
// presenting the user toward "Registrarse" rather than two stacked blocks.
// The button is anchored near the bottom edge (safe-area aware, matching
// BottomSheet/TabBar's existing env(safe-area-inset-bottom) convention)
// with Nexa positioned just above it, overlapping into the button's
// padding area for a composed (not merely adjacent) look.
function FormStepView({
  phone,
  name,
  email,
  emailValid,
  canContinue,
  nexaReady,
  lookAt,
  onNameChange,
  onEmailChange,
  onFocusField,
  onSubmit,
}: FormStepViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col gap-0.5 mb-4">
        <h1 className="text-h1 text-text">Creemos tu cuenta</h1>
        <p className="text-body text-text-muted">Solo necesitamos un par de datos para empezar.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 flex-1 min-h-0">
        <Input
          type="text"
          label="Nombre completo"
          placeholder="Tu nombre completo"
          prefix={<User className="size-5" />}
          autoComplete="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => onFocusField('name')}
          onBlur={() => onFocusField(null)}
          required
        />
        <Input
          type="email"
          label="Correo"
          placeholder="tucorreo@ejemplo.com"
          prefix={<Mail className="size-5" />}
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onFocus={() => onFocusField('email')}
          onBlur={() => onFocusField(null)}
          error={!emailValid ? 'Ingresa un correo válido' : undefined}
          helperText={emailValid ? 'Opcional — lo usamos para verificar tu cuenta y notificarte, no para iniciar sesión' : undefined}
        />
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 h-11">
          <span className="text-text text-[16px]">{phone}</span>
        </div>

        {/* Bottom composition: Nexa's hero "stage" spans the FULL WIDTH and
            fills the remaining viewport (flex-1), anchored to the bottom
            regardless of how much space the compact form above took. The
            button is absolutely positioned ON TOP of that stage (not a
            flex sibling), so it overlays Nexa near the bottom edge instead
            of taking its own row — it never pushes/resizes the stage or
            the form fields above, it just appears layered over her. The
            button itself stays unmounted (not just disabled) until the
            form is valid, appearing right as Nexa's one-shot "ready"
            gesture plays — reads as Nexa revealing/presenting it rather
            than a dead control sitting there from the start. Entrance is a
            short fade+rise, skipped under reduced motion via the same
            motion-reduce: variant used elsewhere in this file (StepSlide
            transitions above). */}
        <div className="relative flex-1 min-h-0 mt-2">
          <NexaMascot state={nexaReady ? 'ready' : 'idle'} hero lookAt={lookAt} className="absolute inset-0" />
          {canContinue && (
            <div className="absolute inset-x-0 bottom-0 px-0 safe-bottom">
              <Button
                type="submit"
                size="lg"
                fullWidth
                className="relative z-10 animate-nexa-entrance motion-reduce:animate-none"
              >
                Registrarse
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
