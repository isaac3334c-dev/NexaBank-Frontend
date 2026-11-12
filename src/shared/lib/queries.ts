import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface AccountResponse {
  id: string;
  name: string;
  balance: number;
  currency: string;
  type: string;
  status: string;
}

export interface TransactionResponse {
  id: string;
  name: string;
  note: string | null;
  amount: number;
  incoming: boolean;
  color: string | null;
}

export interface PageResponse<T> {
  data: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  nextCursor: string | null;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  relatedResourceType: string | null;
  relatedResourceId: string | null;
  createdAt: string;
}

export interface CardResponse {
  id: string;
  accountId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  status: string;
  dailyLimit: number;
  monthlyLimit: number;
  createdAt: string;
}

export interface TopupResponse {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  source: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface WithdrawalResponse {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  destination: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export function useWalletQuery() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: () => apiFetch<AccountResponse[]>('/wallets'),
  });
}

export function useTransactionsQuery() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiFetch<PageResponse<TransactionResponse>>('/transactions'),
  });
}

// GET /notifications uses real Firestore cursor pagination (no page/size
// in-memory mode — see NotificationController's javadoc), so this follows
// the cursor the backend hands back rather than an index-based page number.
export function useNotificationsQuery() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const search = new URLSearchParams({ size: '20' });
      if (pageParam) search.set('cursor', pageParam);
      return apiFetch<PageResponse<NotificationResponse>>(`/notifications?${search.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useCardsQuery() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: () => apiFetch<CardResponse[]>('/cards'),
  });
}

export function useTopupsQuery() {
  return useQuery({
    queryKey: ['topups'],
    queryFn: () => apiFetch<TopupResponse[]>('/topups'),
  });
}

export function useWithdrawalsQuery() {
  return useQuery({
    queryKey: ['withdrawals'],
    queryFn: () => apiFetch<WithdrawalResponse[]>('/withdrawals'),
  });
}

// Called after a successful transfer so Home reflects the new balance/
// transaction without a manual refetch wire-up at every call site.
export function useInvalidateWallet() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };
}

export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

export function useInvalidateCards() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cards'] });
}

export function useInvalidateTopups() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['topups'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };
}

export function useInvalidateWithdrawals() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };
}
