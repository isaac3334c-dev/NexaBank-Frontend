import { apiFetch } from '@/shared/lib/api';
import type { WithdrawalResponse } from '@/shared/lib/queries';

export type WithdrawalDestination = 'CARD' | 'BANK_TRANSFER' | 'CASH';

export interface CreateWithdrawalRequest {
  accountId: string;
  amount: number;
  currency: string;
  destination: WithdrawalDestination;
}

export const withdrawApi = {
  create(request: CreateWithdrawalRequest, confirmationToken: string) {
    return apiFetch<WithdrawalResponse>('/withdrawals', {
      method: 'POST',
      body: request,
      headers: {
        'Idempotency-Key': crypto.randomUUID(),
        'X-Confirmation-Token': confirmationToken,
      },
    });
  },

  cancel(id: string) {
    return apiFetch<WithdrawalResponse>(`/withdrawals/${id}/cancel`, { method: 'POST' });
  },
};
