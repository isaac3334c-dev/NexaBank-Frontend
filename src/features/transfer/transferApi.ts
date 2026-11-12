import { apiFetch } from '@/shared/lib/api';

// NOT the same thing as /beneficiaries (that's for international SWIFT/IBAN
// transfers — see BeneficiaryResponse). P2P transfers between NexaBank users
// resolve the recipient's internal accountId by phone via this endpoint.
export interface RecipientLookup {
  accountId: string;
  displayName: string;
}

export interface QuoteResponse {
  quoteId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  sourceAmount: number;
  sourceCurrency: string;
  destinationAmount: number;
  destinationCurrency: string;
  rate: number;
  fee: number;
  total: number;
  expiresAt: string;
  trackingNumber: string | null;
}

export interface CreateTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  currency: string;
  description?: string;
}

export interface TransferResponse {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  sourceCurrency: string;
  destinationCurrency: string;
  destinationAmount: number;
  currency: string;
  fee: number;
  status: string;
  description: string | null;
  trackingNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const transferApi = {
  lookupRecipient(phone: string) {
    return apiFetch<RecipientLookup>(`/users/lookup?phone=${encodeURIComponent(phone)}`);
  },

  quote(request: CreateTransferRequest) {
    return apiFetch<QuoteResponse>('/transfers/quote', { method: 'POST', body: request });
  },

  create(request: CreateTransferRequest, confirmationToken: string) {
    return apiFetch<TransferResponse>('/transfers', {
      method: 'POST',
      body: request,
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
        'X-Confirmation-Token': confirmationToken,
      },
    });
  },
};
