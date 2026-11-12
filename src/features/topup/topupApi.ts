import { apiFetch } from '@/shared/lib/api';
import type { TopupResponse } from '@/shared/lib/queries';

export type TopupSource = 'CARD' | 'BANK_TRANSFER' | 'CASH';

export interface CreateTopupRequest {
  accountId: string;
  amount: number;
  currency: string;
  source: TopupSource;
}

export const topupApi = {
  create(request: CreateTopupRequest, confirmationToken: string) {
    return apiFetch<TopupResponse>('/topups', {
      method: 'POST',
      body: request,
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
        'X-Confirmation-Token': confirmationToken,
      },
    });
  },
};
