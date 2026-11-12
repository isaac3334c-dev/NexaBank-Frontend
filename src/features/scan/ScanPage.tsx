import { useEffect, useRef, useState } from 'react';
import { QrCode, Search, Store } from 'lucide-react';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Avatar } from '@/shared/ui/Avatar';
import { NumericKeypad } from '@/shared/ui/NumericKeypad';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';
import { PinConfirmSheet } from '@/shared/ui/PinConfirmSheet';
import { useInvalidateWallet, useWalletQuery } from '@/shared/lib/queries';
import { getErrorMessage } from '@/shared/lib/api';
import { scanApi, type QrDecodeResult } from './scanApi';

type ScanStep = 'input' | 'amount' | 'result';

// Real camera scanning via the native Barcode Detection API (Chrome/Edge/
// Android Chrome — no polyfill, no new dependency, per this project's "no
// new dependencies unless strictly necessary" rule). Feature-detected at
// runtime; Safari/iOS and any browser lacking `BarcodeDetector` fall back
// to the manual paste/type input below, which exercises the exact same
// decode -> confirm merchant -> PIN -> pay flow — only *how* qrData gets
// filled changes.
const CAMERA_SUPPORTED =
  typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

export function ScanPage() {
  const walletQuery = useWalletQuery();
  const invalidateWallet = useInvalidateWallet();

  const [step, setStep] = useState<ScanStep>('input');
  const [manualEntry, setManualEntry] = useState(!CAMERA_SUPPORTED);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrData, setQrData] = useState('');
  const [decoded, setDecoded] = useState<QrDecodeResult | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payResult, setPayResult] = useState<{ ok: boolean; message: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanLockedRef = useRef(false);

  const account = walletQuery.data?.[0];

  async function decode(data: string) {
    if (!data.trim()) return;
    setDecoding(true);
    setDecodeError(null);
    try {
      const result = await scanApi.decode(data.trim());
      setDecoded(result);
      setStep('amount');
    } catch (err) {
      setDecodeError(getErrorMessage(err));
    } finally {
      setDecoding(false);
    }
  }

  function handleDecode() {
    return decode(qrData);
  }

  function stopCamera() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (step !== 'input' || manualEntry) {
      stopCamera();
      return;
    }

    let cancelled = false;
    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLockedRef.current = false;

        const tick = async () => {
          if (cancelled || scanLockedRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              scanLockedRef.current = true;
              const value = codes[0].rawValue;
              setQrData(value);
              stopCamera();
              await decode(value);
              return;
            }
          } catch {
            // Transient detect() failures (e.g. video not ready yet) — keep polling.
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setCameraError('No pudimos acceder a tu cámara. Revisa los permisos del navegador.');
      }
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [step, manualEntry]);

  function handleAmountKey(key: string) {
    if (key === 'back') {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    if (key === '.' && amount.includes('.')) return;
    const next = amount + key;
    const decimals = next.split('.')[1];
    if (decimals && decimals.length > 2) return;
    if (next.replace('.', '').length > 9) return;
    setAmount(next);
  }

  async function handlePinConfirmed(confirmationToken: string) {
    try {
      const result = await scanApi.pay(
        { qrData: qrData.trim(), amount, currency: account?.currency },
        confirmationToken,
      );
      setPinOpen(false);
      if (result.success) {
        invalidateWallet();
        setPayResult({ ok: true, message: `Pagaste ${amount} ${account?.currency ?? ''} a ${result.merchant ?? decoded?.merchant}` });
      } else {
        setPayResult({ ok: false, message: result.error ?? 'No se pudo completar el pago.' });
      }
      setStep('result');
    } catch (err) {
      setPayError(getErrorMessage(err));
      throw err;
    }
  }

  function handleReset() {
    setStep('input');
    setQrData('');
    setDecoded(null);
    setDecodeError(null);
    setAmount('');
    setPayError(null);
    setPayResult(null);
    setManualEntry(!CAMERA_SUPPORTED);
    setCameraError(null);
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title="Escanear QR" onBack={step !== 'input' ? handleReset : undefined} />

      <div className="flex-1 flex flex-col px-5 pt-4">
        {step === 'input' && !manualEntry && (
          <div className="flex flex-col gap-4">
            <div className="relative w-full aspect-square rounded-[var(--radius-lg)] overflow-hidden bg-surface-2">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-[18%] border-2 border-primary rounded-[var(--radius-md)] pointer-events-none" />
            </div>

            {decoding && <p className="text-caption text-text-muted text-center">Verificando código…</p>}
            {decodeError && <p className="text-caption text-danger text-center">{decodeError}</p>}
            {cameraError && <p className="text-caption text-danger text-center">{cameraError}</p>}

            <button
              type="button"
              className="text-caption font-medium text-primary text-center"
              onClick={() => setManualEntry(true)}
            >
              Ingresar código manualmente
            </button>
          </div>
        )}

        {step === 'input' && manualEntry && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex items-center justify-center size-16 rounded-full bg-surface-2 text-text-muted">
                <QrCode className="size-7" />
              </span>
              <p className="text-body text-text-muted max-w-[280px]">
                {CAMERA_SUPPORTED
                  ? 'Pega o escribe el código QR del comercio para continuar.'
                  : 'La cámara no está disponible en este navegador. Pega o escribe el código QR del comercio para continuar.'}
              </p>
            </div>

            <Input
              label="Código QR"
              placeholder="nexabank:pay:ACC-123456:Tienda"
              value={qrData}
              onChange={(e) => setQrData(e.target.value)}
            />

            {decodeError && <p className="text-caption text-danger">{decodeError}</p>}

            <Button
              size="lg"
              fullWidth
              loading={decoding}
              disabled={!qrData.trim()}
              leftIcon={<Search className="size-4" />}
              onClick={handleDecode}
            >
              Continuar
            </Button>

            {CAMERA_SUPPORTED && (
              <button
                type="button"
                className="text-caption font-medium text-primary text-center"
                onClick={() => setManualEntry(false)}
              >
                Usar la cámara
              </button>
            )}
          </div>
        )}

        {step === 'amount' && decoded && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <Avatar name={decoded.merchant ?? 'Comercio'} size="sm" />
              <div>
                <p className="text-caption text-text-muted">Pagar a</p>
                <p className="text-body-strong text-text">{decoded.merchant ?? 'Comercio desconocido'}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <p aria-live="polite">
                <MoneyDisplay
                  formatted={`${account?.currency ?? 'PEN'} ${amount || '0'}`}
                  className="inline-flex items-baseline"
                  wholeClassName="font-tabular text-text text-[44px] font-semibold tracking-[-0.02em]"
                  decimalClassName="font-tabular text-text-muted text-[26px] font-semibold tracking-[-0.02em]"
                />
              </p>
              {payError && <p className="text-caption text-danger">{payError}</p>}
            </div>

            <NumericKeypad onKey={handleAmountKey} showDecimal />

            <Button
              size="lg"
              fullWidth
              disabled={!(Number(amount) > 0)}
              onClick={() => {
                setPayError(null);
                setPinOpen(true);
              }}
              className="mb-2"
            >
              Pagar
            </Button>
          </div>
        )}

        {step === 'result' && payResult && (
          <div className="flex flex-col h-full items-center justify-center text-center gap-4">
            <span
              className="flex items-center justify-center size-20 rounded-full"
              style={{
                backgroundColor: payResult.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                color: payResult.ok ? 'var(--color-success)' : 'var(--color-danger)',
              }}
              aria-hidden="true"
            >
              <Store className="size-8" />
            </span>
            <div>
              <h1 className="text-h2 text-text">{payResult.ok ? '¡Pago exitoso!' : 'No se pudo pagar'}</h1>
              <p className="text-body text-text-muted mt-1">{payResult.message}</p>
            </div>
            <Button size="lg" fullWidth onClick={handleReset} className="mt-6">
              Escanear otro código
            </Button>
          </div>
        )}
      </div>

      <PinConfirmSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Confirma el pago"
        description="Ingresa tu PIN para pagar con QR"
        onConfirmed={handlePinConfirmed}
      />
    </div>
  );
}
