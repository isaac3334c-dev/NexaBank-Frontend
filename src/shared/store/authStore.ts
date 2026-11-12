import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserResponse } from '@/features/auth/authApi';

interface AuthState {
  /** Phone currently going through the auth flow (not yet necessarily authenticated). */
  phone: string | null;
  /** Cached profile from the last successful AuthResponse — real source of
   *  truth is Firebase's own auth state (see SplashPage bootstrap) plus
   *  GET /auth/me; this is only a display-layer cache. */
  user: UserResponse | null;
  /**
   * Short-lived (5 min), single-use token minted by POST /auth/pin/verify.
   * Deliberately NOT persisted to localStorage — see `partialize` below —
   * it's only meant to survive the in-memory lifetime of a confirm step.
   */
  confirmationToken: string | null;

  setPhone: (phone: string) => void;
  setUser: (user: UserResponse | null) => void;
  setConfirmationToken: (token: string | null) => void;
  clear: () => void;
}

// localStorage can throw (private browsing, quota, disabled storage) — wrap
// access so a storage failure never crashes the app, it just falls back to
// in-memory (non-persisted) state for the session. Mirrors uiStore.ts.
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      phone: null,
      user: null,
      confirmationToken: null,

      setPhone: (phone) => set({ phone }),
      setUser: (user) => set({ user }),
      setConfirmationToken: (token) => set({ confirmationToken: token }),
      clear: () => set({ phone: null, user: null, confirmationToken: null }),
    }),
    {
      name: 'nexabank-auth',
      storage: safeLocalStorage(),
      // confirmationToken never touches localStorage, even if persist's
      // write happens to fire while one is set in memory.
      partialize: (state) => ({ phone: state.phone, user: state.user }),
    },
  ),
);
