import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User, Globe2, KeyRound, ArrowLeftRight, CreditCard, Wallet, ChevronDown, IdCard, MapPin } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { StepSlide } from '@/shared/ui/StepSlide';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { NexaMascot, type NexaState, type NexaLookAt } from '@/shared/ui/NexaMascot';
import { useAuthStore } from '@/shared/store/authStore';
import { authApi } from '@/features/auth/authApi';
import { getErrorMessage } from '@/shared/lib/api';
import { CountryPickerSheet } from '@/features/auth/CountryPickerSheet';
import { DEFAULT_COUNTRY, type Country } from '@/shared/lib/countries';

interface TourSlide {
  nexaState: NexaState;
  icon?: ReactNode;
  headline: string;
  body: string;
  buttonLabel: string;
}

// Steps 0-5: the benefit tour. Step 6 is the personal-info form, step 7 is
// PIN creation (split out so the backend's /auth/register payload — which
// bundles the PIN with the rest of the profile in one call — doesn't force
// a cramped single screen with 7 fields + a PIN pad).
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
const PIN_STEP = FORM_STEP + 1; // 7
const PIN_LENGTH = 4;

// Deliberately simple — just enough to catch obviously malformed addresses
// typed into an optional field, not full RFC 5322 validation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const phone = useAuthStore((s) => s.phone);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!phone) navigate('/auth/phone', { replace: true });
  }, [phone, navigate]);

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [focusedField, setFocusedField] = useState<'firstName' | 'email' | null>(null);

  const [pinStage, setPinStage] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [pinMismatch, setPinMismatch] = useState(false);
  const [pinShake, setPinShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevStepRef = useRef(step);
  const direction = step >= prevStepRef.current ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);

  const emailTrimmed = email.trim();
  const emailValid = emailTrimmed.length === 0 || EMAIL_PATTERN.test(emailTrimmed);
  const canContinue =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    documentId.trim().length > 0 &&
    address.trim().length > 0 &&
    emailValid;
  const onFormStep = step === FORM_STEP;
  const onPinStep = step === PIN_STEP;

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

  const lookAt = focusedField === 'firstName' ? 'left' : focusedField === 'email' ? 'right' : 'neutral';

  function goNext() {
    setStep((s) => Math.min(s + 1, PIN_STEP));
  }

  function handleSkip() {
    setStep(FORM_STEP);
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    setStep(PIN_STEP);
  }

  async function submitRegistration(finalPin: string) {
    if (!phone) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await authApi.register({
        phone,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        documentId: documentId.trim(),
        address: address.trim(),
        country: country.iso2,
        email: emailTrimmed || undefined,
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        pin: finalPin,
      });
      setUser(response.user);
      navigate('/auth/loading');
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      setPinStage('enter');
      setFirstPin('');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePinKey(key: string) {
    if (submitting) return;
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      if (pinStage === 'enter') {
        setFirstPin(next);
        window.setTimeout(() => {
          setPinStage('confirm');
          setPin('');
        }, 150);
      } else if (next === firstPin) {
        submitRegistration(next);
      } else {
        setPinMismatch(true);
        setPinShake(true);
        window.setTimeout(() => {
          setPinShake(false);
          setPinMismatch(false);
          setPinStage('enter');
          setFirstPin('');
          setPin('');
        }, 400);
      }
    }
  }

  return (
    <div className="flex flex-col min-h-dvh py-10">
      {!onFormStep && !onPinStep && (
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

      {!onFormStep && !onPinStep && (
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
        {!onFormStep && !onPinStep ? (
          <StepSlide key={step} direction={direction} className="flex-1 flex flex-col transition-[transform,opacity] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none">
            <TourSlideView slide={TOUR_SLIDES[step]} onNext={goNext} />
          </StepSlide>
        ) : onFormStep ? (
          <StepSlide
            key={step}
            direction={direction}
            className="flex-1 flex flex-col transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          >
            <FormStepView
              phone={phone ?? ''}
              firstName={firstName}
              lastName={lastName}
              documentId={documentId}
              address={address}
              country={country}
              email={email}
              emailValid={emailValid}
              canContinue={canContinue}
              nexaReady={nexaReady}
              lookAt={lookAt}
              onFirstNameChange={setFirstName}
              onLastNameChange={setLastName}
              onDocumentIdChange={setDocumentId}
              onAddressChange={setAddress}
              onOpenCountryPicker={() => setCountryPickerOpen(true)}
              onEmailChange={setEmail}
              onFocusField={setFocusedField}
              onSubmit={handleFormSubmit}
            />
          </StepSlide>
        ) : (
          <StepSlide
            key={step}
            direction={direction}
            className="flex-1 flex flex-col transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
          >
            <PinStepView
              stage={pinStage}
              pin={pin}
              mismatch={pinMismatch}
              shake={pinShake}
              submitting={submitting}
              submitError={submitError}
              onKey={handlePinKey}
            />
          </StepSlide>
        )}
      </div>

      <CountryPickerSheet open={countryPickerOpen} onOpenChange={setCountryPickerOpen} onSelect={setCountry} />
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
  firstName: string;
  lastName: string;
  documentId: string;
  address: string;
  country: Country;
  email: string;
  emailValid: boolean;
  canContinue: boolean;
  nexaReady: boolean;
  lookAt: NexaLookAt;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onDocumentIdChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onOpenCountryPicker: () => void;
  onEmailChange: (v: string) => void;
  onFocusField: (field: 'firstName' | 'email' | null) => void;
  onSubmit: (e: FormEvent) => void;
}

// Form step (step 6): scrollable field list (the backend's /auth/register
// contract needs more than name+email — see docs/DECISIONS.md decision log
// for this cableado), with Nexa's hero "ready" composition anchored below,
// same presenting-the-button gesture as before.
function FormStepView({
  phone,
  firstName,
  lastName,
  documentId,
  address,
  country,
  email,
  emailValid,
  canContinue,
  nexaReady,
  lookAt,
  onFirstNameChange,
  onLastNameChange,
  onDocumentIdChange,
  onAddressChange,
  onOpenCountryPicker,
  onEmailChange,
  onFocusField,
  onSubmit,
}: FormStepViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col gap-0.5 mb-4">
        <h1 className="text-h1 text-text">Creemos tu cuenta</h1>
        <p className="text-body text-text-muted">Necesitamos estos datos para verificar tu identidad.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-col gap-3 overflow-y-auto -mx-5 px-5 pb-2">
          <Input
            type="text"
            label="Nombres"
            placeholder="Tu nombre"
            prefix={<User className="size-5" />}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            onFocus={() => onFocusField('firstName')}
            onBlur={() => onFocusField(null)}
            required
          />
          <Input
            type="text"
            label="Apellidos"
            placeholder="Tus apellidos"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
            required
          />
          <Input
            type="text"
            label="Documento de identidad"
            placeholder="DNI, cédula o pasaporte"
            prefix={<IdCard className="size-5" />}
            autoComplete="off"
            value={documentId}
            onChange={(e) => onDocumentIdChange(e.target.value)}
            required
          />
          <Input
            type="text"
            label="Dirección"
            placeholder="Tu dirección actual"
            prefix={<MapPin className="size-5" />}
            autoComplete="street-address"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-body-strong text-text">País</label>
            <button
              type="button"
              onClick={onOpenCountryPicker}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 h-12 text-left"
            >
              <span aria-hidden="true">{country.flag}</span>
              <span className="flex-1 text-text text-[16px]">{country.name}</span>
              <ChevronDown className="size-4 text-text-muted" aria-hidden="true" />
            </button>
          </div>
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
            helperText={emailValid ? 'Opcional — lo usamos para notificarte, no para iniciar sesión' : undefined}
          />
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 h-11">
            <span className="text-text text-[16px]">{phone}</span>
          </div>
        </div>

        <div className="relative shrink-0 h-[140px] mt-2">
          <NexaMascot state={nexaReady ? 'ready' : 'idle'} hero lookAt={lookAt} className="absolute inset-0" />
          {canContinue && (
            <div className="absolute inset-x-0 bottom-0 px-0 safe-bottom">
              <Button
                type="submit"
                size="lg"
                fullWidth
                className="relative z-10 animate-nexa-entrance motion-reduce:animate-none"
              >
                Continuar
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

interface PinStepViewProps {
  stage: 'enter' | 'confirm';
  pin: string;
  mismatch: boolean;
  shake: boolean;
  submitting: boolean;
  submitError: string | null;
  onKey: (key: string) => void;
}

// PIN step (step 7): same enter->confirm pattern as CreatePinPage, since
// this is the exact same operation (choosing a PIN) just reached via the
// registration flow — the backend bundles it into one /auth/register call
// instead of a separate /auth/pin/setup request.
function PinStepView({ stage, pin, mismatch, shake, submitting, submitError, onKey }: PinStepViewProps) {
  const title = stage === 'enter' ? 'Crea tu PIN' : 'Confirma tu PIN';
  const subtitle =
    stage === 'enter'
      ? 'Usarás este PIN de 4 dígitos para desbloquear tu billetera'
      : 'Ingresa el mismo PIN nuevamente';

  return (
    <div className="flex flex-col flex-1">
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

      {mismatch && (
        <p className="text-caption text-danger text-center mb-4">Los PIN no coinciden. Intenta de nuevo.</p>
      )}
      {submitError && <p className="text-caption text-danger text-center mb-4">{submitError}</p>}
      {submitting && <p className="text-caption text-text-muted text-center mb-4">Creando tu cuenta…</p>}

      <div className="mt-auto">
        <NumericKeypad onKey={onKey} showDecimal={false} />
      </div>
    </div>
  );
}
