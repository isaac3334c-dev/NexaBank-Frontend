import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '@/shared/lib/firebase';
import { apiFetch } from '@/shared/lib/api';

export interface UserResponse {
  id: string;
  email: string | null;
  displayName: string;
  phone: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  message: string;
  token: string | null;
  requiresRegistration: boolean | null;
  requiresPin: boolean | null;
  authenticated: boolean;
  user: UserResponse | null;
  confirmationToken: string | null;
}

export interface RegisterPayload {
  phone: string;
  firstName: string;
  lastName: string;
  documentId: string;
  address: string;
  country: string;
  email?: string;
  displayName: string;
  pin: string;
}

// Identifies this browser across sessions so the backend can distinguish
// "known device, just needs PIN" from "brand new device" — same purpose as
// the deviceId NexaBank-Mobile sends, just persisted in localStorage instead
// of AsyncStorage since there's no native device identifier on web.
function getDeviceId(): string {
  const KEY = 'nexabank-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function deviceInfo() {
  return {
    deviceId: getDeviceId(),
    deviceName: navigator.userAgent.slice(0, 80),
    platform: 'web',
  };
}

// Firebase custom tokens are only usable once this call resolves — every
// AuthResponse-returning endpoint below may include one, so the exchange is
// centralized here instead of repeated at each call site.
async function applyToken(response: AuthResponse): Promise<AuthResponse> {
  if (response.token) {
    await signInWithCustomToken(auth, response.token);
  }
  return response;
}

export const authApi = {
  startPhone(phone: string) {
    return apiFetch<AuthResponse>('/auth/phone/start', { method: 'POST', body: { phone } });
  },

  async verifyPhone(phone: string, code: string) {
    const response = await apiFetch<AuthResponse>('/auth/phone/verify', {
      method: 'POST',
      body: { phone, code },
    });
    return applyToken(response);
  },

  async register(payload: RegisterPayload) {
    const response = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    });
    return applyToken(response);
  },

  async setupPin(pin: string) {
    const response = await apiFetch<AuthResponse>('/auth/pin/setup', {
      method: 'POST',
      body: { pin, ...deviceInfo() },
    });
    return applyToken(response);
  },

  async verifyPin(pin: string) {
    const response = await apiFetch<AuthResponse>('/auth/pin/verify', {
      method: 'POST',
      body: { pin, ...deviceInfo() },
    });
    return applyToken(response);
  },

  getMe() {
    return apiFetch<AuthResponse>('/auth/me');
  },

  async logout() {
    await signOut(auth);
    await apiFetch<AuthResponse>('/auth/logout', { method: 'POST' }).catch(() => undefined);
  },
};
