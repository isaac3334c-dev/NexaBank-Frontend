import { create } from 'zustand';
import type { Contact } from '@/shared/types/domain';

export type TransferStep = 'contact' | 'amount' | 'confirm' | 'result';

interface TransferFlowState {
  step: TransferStep;
  contact: Contact | null;
  amount: string;
  setStep: (step: TransferStep) => void;
  setContact: (contact: Contact) => void;
  setAmount: (amount: string) => void;
  reset: () => void;
}

const initialState = {
  step: 'contact' as TransferStep,
  contact: null as Contact | null,
  amount: '',
};

export const useTransferFlowStore = create<TransferFlowState>()((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setContact: (contact) => set({ contact, step: 'amount' }),
  setAmount: (amount) => set({ amount }),
  reset: () => set({ ...initialState }),
}));
