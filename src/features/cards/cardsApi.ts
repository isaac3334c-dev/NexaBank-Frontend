import { apiFetch } from '@/shared/lib/api';
import type { CardResponse } from '@/shared/lib/queries';

export interface CreateCardRequest {
  accountId: string;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export interface UpdateCardRequest {
  status?: 'ACTIVE' | 'BLOCKED';
  dailyLimit?: number;
  monthlyLimit?: number;
}

export const cardsApi = {
  // POST /cards never shows the PAN/CVV back to the client — the backend's
  // CardResponse DTO deliberately omits the issuer token and only exposes
  // `last4`, so there is nothing more to mask here; this is the full card
  // detail the API will ever return.
  issue(request: CreateCardRequest, confirmationToken: string) {
    return apiFetch<CardResponse>('/cards', {
      method: 'POST',
      body: request,
      headers: { 'X-Confirmation-Token': confirmationToken },
    });
  },

  update(id: string, request: UpdateCardRequest) {
    return apiFetch<CardResponse>(`/cards/${id}`, { method: 'PATCH', body: request });
  },

  cancel(id: string, confirmationToken: string) {
    return apiFetch<void>(`/cards/${id}`, {
      method: 'DELETE',
      headers: { 'X-Confirmation-Token': confirmationToken },
    });
  },
};
