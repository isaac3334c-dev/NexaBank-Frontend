// Core domain model shared across features. Mock-backed for this phase —
// shapes mirror the eventual API contract (see docs/API_AUDIT.md) so the
// swap to real data in a later phase is additive, not a rewrite.

export type Money = {
  amount: string;
  currency: string;
};

export type TransactionType =
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'TOPUP'
  | 'WITHDRAWAL'
  | 'QR_PAYMENT'
  | 'CARD_PAYMENT'
  | 'FEE'
  | 'REFUND';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Counterparty {
  name: string;
  identifier: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Money;
  counterparty?: Counterparty;
  description?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  identifier: string;
  avatarUrl?: string;
  frequent?: boolean;
}

export interface Account {
  id: string;
  ownerName: string;
  balance: Money;
}
