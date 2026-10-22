import { create } from 'zustand';
import type { Account, Contact, Transaction } from '@/shared/types/domain';
import { mockAccount, mockContacts, mockTransactions } from '@/shared/types/mockData';

interface WalletState {
  account: Account;
  contacts: Contact[];
  transactions: Transaction[];
  /**
   * Mock "completes a transfer": decrements the account balance by
   * amount + fee, and prepends a new TRANSFER_OUT transaction. Amounts are
   * handled as strings end-to-end; Number() conversion happens only at this
   * single arithmetic boundary (acceptable for mock data — see money.ts
   * comment for why this is not the pattern for real money movement).
   */
  completeTransfer: (params: { contact: Contact; amount: string; fee: string }) => Transaction;
}

export const useWalletStore = create<WalletState>()((set, get) => ({
  account: mockAccount,
  contacts: mockContacts,
  transactions: mockTransactions,
  completeTransfer: ({ contact, amount, fee }) => {
    const { account, transactions } = get();
    const currency = account.balance.currency;
    const newBalance = (Number(account.balance.amount) - Number(amount) - Number(fee)).toFixed(2);

    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'TRANSFER_OUT',
      status: 'COMPLETED',
      amount: { amount, currency },
      counterparty: { name: contact.name, identifier: contact.identifier },
      description: 'Transferencia enviada',
      createdAt: new Date().toISOString(),
    };

    set({
      account: { ...account, balance: { amount: newBalance, currency } },
      transactions: [transaction, ...transactions],
    });

    return transaction;
  },
}));
