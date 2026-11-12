import { useState } from 'react';
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

// No camera-based QR scanning library is bundled in this project yet
// (no @zxing/qrcode-scanner-style dependency in package.json, and the
// project's "no new dependencies unless strictly necessary" rule applies).
// Rather than ship Scan QR as a pure stub, this implements the fully
// functional fallback: paste/type the QR's raw payload (the same string a
// camera scan would have extracted) and decode it through the real
// GET /qr/decode endpoint. Wiring an actual camera (getUserMedia + a
// decode library) is a follow-up — it only affects *how* qrData is
// captured, not the decode/pay flow below, so swapping it in later is
// additive.
export function ScanPage() {
  const walletQuery = useWalletQuery();
  const invalidateWallet = useInvalidateWallet();

  const [step, setStep] = useState<ScanStep>('input');
  const [qrData, setQrData] = useState('');
  const [decoded, setDecoded] = useState<QrDecodeResult | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payResult, setPayResult] = useState<{ ok: boolean; message: string } | null>(null);

  const account = walletQuery.data?.[0];

  async function handleDecode() {
    if (!qrData.trim()) return;
    setDecoding(true);
    setDecodeError(null);
    try {
      const result = await scanApi.decode(qrData.trim());
      setDecoded(result);
      setStep('amount');
    } catch (err) {
      setDecodeError(getErrorMessage(err));
    } finally {
      setDecoding(false);
    }
  }

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
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title="Escanear QR" onBack={step !== 'input' ? handleReset : undefined} />

      <div className="flex-1 flex flex-col px-5 pt-4">
        {step === 'input' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex items-center justify-center size-16 rounded-full bg-surface-2 text-text-muted">
                <QrCode className="size-7" />
              </span>
              <p className="text-body text-text-muted max-w-[280px]">
                La cámara no está disponible en esta versión. Pega o escribe el código QR del
                comercio para continuar.
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
