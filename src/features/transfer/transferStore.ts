import { create } from 'zustand';
import type { QuoteResponse, TransferResponse } from './transferApi';

export type TransferStep = 'contact' | 'amount' | 'confirm' | 'result';

interface Recipient {
  accountId: string;
  displayName: string;
  phone: string;
}

interface TransferFlowState {
  step: TransferStep;
  recipient: Recipient | null;
  amount: string;
  quote: QuoteResponse | null;
  result: TransferResponse | null;
  error: string | null;
  setStep: (step: TransferStep) => void;
  setRecipient: (recipient: Recipient) => void;
  setAmount: (amount: string) => void;
  setQuote: (quote: QuoteResponse | null) => void;
  setResult: (result: TransferResponse) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  step: 'contact' as TransferStep,
  recipient: null as Recipient | null,
  amount: '',
  quote: null as QuoteResponse | null,
  result: null as TransferResponse | null,
  error: null as string | null,
};

export const useTransferFlowStore = create<TransferFlowState>()((set) => ({
  ...initialState,
  setStep: (step) => set({ step, error: null }),
  setRecipient: (recipient) => set({ recipient, step: 'amount' }),
  setAmount: (amount) => set({ amount }),
  setQuote: (quote) => set({ quote }),
  setResult: (result) => set({ result, step: 'result' }),
  setError: (error) => set({ error }),
  reset: () => set({ ...initialState }),
}));
