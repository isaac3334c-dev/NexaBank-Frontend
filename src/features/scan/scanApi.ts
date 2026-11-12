import { apiFetch } from '@/shared/lib/api';

// Both endpoints return Map<String, Object> on the backend (see
// QrController/QrService) rather than a typed DTO. Field names below match
// QrService.decodeQr()/processQrPayment() exactly: decode only ever
// populates `accountId`/`merchant` (format "nexabank:pay:ACC-123:Merchant",
// or treats the whole string as the accountId if it doesn't match that
// prefix — there is no "invalid QR" error from decode, just a merchant of
// "Unknown"). pay() is notable for NOT using HTTP error status on business
// failures (insufficient funds, missing account) — it returns 200 with
// `success: false` and an `error` string instead, so callers must check
// `success` explicitly rather than relying on a thrown ApiError.
export interface QrDecodeResult {
  accountId?: string;
  merchant?: string;
}

export interface QrPayResult {
  success: boolean;
  error?: string;
  transactionId?: string;
  amount?: number;
  merchant?: string;
  destinationAccount?: string;
  newBalance?: number;
  timestamp?: string;
}

export const scanApi = {
  decode(data: string) {
    return apiFetch<QrDecodeResult>(`/qr/decode?data=${encodeURIComponent(data)}`);
  },

  pay(
    request: { qrData: string; amount: string; currency?: string; description?: string },
    confirmationToken: string,
  ) {
    return apiFetch<QrPayResult>('/qr/pay', {
      method: 'POST',
      body: request,
      headers: { 'X-Confirmation-Token': confirmationToken },
    });
  },
};
