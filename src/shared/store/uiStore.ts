import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiState {
  isBalanceHidden: boolean;
  toggleBalanceHidden: () => void;
}

// localStorage can throw (private browsing, quota, disabled storage) —
// wrap access so a storage failure never crashes the app, it just falls
// back to in-memory (non-persisted) state for the session.
function safeLocalStorage() {
  try {
    const testKey = '__nexabank_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return createJSONStorage(() => window.localStorage);
  } catch {
    const memory = new Map<string, string>();
    return createJSONStorage(() => ({
      getItem: (name: string) => memory.get(name) ?? null,
      setItem: (name: string, value: string) => {
        memory.set(name, value);
      },
      removeItem: (name: string) => {
        memory.delete(name);
      },
    }));
  }
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isBalanceHidden: false,
      toggleBalanceHidden: () => set((s) => ({ isBalanceHidden: !s.isBalanceHidden })),
    }),
    {
      name: 'nexabank-ui-prefs',
      storage: safeLocalStorage(),
    },
  ),
);
