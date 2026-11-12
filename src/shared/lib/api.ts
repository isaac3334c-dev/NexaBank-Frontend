import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface ApiErrorResponse {
  timestamp?: string;
  status: number;
  error: string;
  message: string;
  path?: string;
  traceId?: string;
}

export class ApiError extends Error {
  constructor(public readonly response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(
      errorBody ?? {
        status: response.status,
        error: 'UNKNOWN_ERROR',
        message: response.statusText,
      },
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// User-facing Spanish copy for the backend's known error codes (see
// GlobalExceptionHandler). Falls back to the raw backend message for codes
// not mapped here, so new backend error codes still surface *something*
// readable instead of silently failing to render.
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_OTP: 'Código incorrecto o expirado. Inténtalo de nuevo.',
  PIN_LOCKED: 'PIN bloqueado por demasiados intentos. Espera unos minutos.',
  INSUFFICIENT_FUNDS: 'Saldo insuficiente para esta operación.',
  INVALID_CONFIRMATION_TOKEN: 'No pudimos confirmar tu PIN. Inténtalo de nuevo.',
  DUPLICATE_USER: 'Ya existe una cuenta con ese número de teléfono.',
  VALIDATION_FAILED: 'Revisa los datos ingresados.',
  RESOURCE_NOT_FOUND: 'No encontramos lo que buscabas.',
  UNAUTHORIZED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  INVALID_TRANSACTION: 'No se pudo completar la operación. Revisa los datos.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  QUOTE_EXPIRED: 'La cotización expiró. Inténtalo de nuevo.',
  MISSING_HEADER: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_MESSAGES[err.response.error] ?? err.response.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
