import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Reuses the existing mock contact "+51 987 654 321" (Rodrigo Salazar) from
// shared/types/mockData.ts so the demo auth user is consistent with the rest
// of the mock data set instead of inventing a disconnected duplicate.
export const DEMO_PHONE = '+51 987 654 321';
export const DEMO_NAME = 'Rodrigo Salazar';
export const DEMO_PIN = '1234';

interface RegisteredUser {
  name: string;
  email?: string;
  pin: string;
}

interface AuthState {
  /** Phone currently going through the auth flow (not yet necessarily authenticated). */
  phone: string | null;
  /** phone -> registered user record. */
  registeredUsers: Record<string, RegisteredUser>;
  /** phone -> whether this device is "recognized" for that phone (skips OTP, goes to PIN). */
  recognizedDevices: Record<string, boolean>;

  setPhone: (phone: string) => void;
  isRegistered: (phone: string) => boolean;
  isDeviceRecognized: (phone: string) => boolean;
  register: (phone: string, data: { name: string; email?: string }) => void;
  setPin: (phone: string, pin: string) => void;
  verifyPin: (phone: string, pin: string) => boolean;
  getUser: (phone: string) => RegisteredUser | undefined;
  forgetDevice: (phone: string) => void;
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
    (set, get) => ({
      phone: null,
      // Seed ONE pre-registered demo user so `/auth/pin` is reachable directly
      // during dev testing. Device recognition is scoped per-phone (not global)
      // on purpose: it must NOT make every phone "recognized" by default, or a
      // fresh phone could never be exercised through phone -> otp -> register ->
      // create-pin.
      registeredUsers: {
        [DEMO_PHONE]: { name: DEMO_NAME, pin: DEMO_PIN },
      },
      recognizedDevices: {
        [DEMO_PHONE]: true,
      },

      setPhone: (phone) => set({ phone }),

      isRegistered: (phone) => Boolean(get().registeredUsers[phone]),

      isDeviceRecognized: (phone) => Boolean(get().recognizedDevices[phone]),

      register: (phone, data) =>
        set((s) => ({
          registeredUsers: {
            ...s.registeredUsers,
            [phone]: { name: data.name, email: data.email, pin: '' },
          },
        })),

      setPin: (phone, pin) =>
        set((s) => ({
          registeredUsers: {
            ...s.registeredUsers,
            [phone]: { ...s.registeredUsers[phone], pin },
          },
          recognizedDevices: {
            ...s.recognizedDevices,
            [phone]: true,
          },
        })),

      verifyPin: (phone, pin) => get().registeredUsers[phone]?.pin === pin,

      getUser: (phone) => get().registeredUsers[phone],

      forgetDevice: (phone) =>
        set((s) => ({
          recognizedDevices: { ...s.recognizedDevices, [phone]: false },
        })),
    }),
    {
      name: 'nexabank-auth',
      storage: safeLocalStorage(),
    },
  ),
);
