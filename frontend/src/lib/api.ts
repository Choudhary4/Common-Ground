const RAW_API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const API_BASE = RAW_API_URL ? `${RAW_API_URL}/api` : '/api';
const TOKEN_KEY = 'cg_session_token';

export function setSessionToken(token: string | null | undefined): void {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearSessionToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong', res.status);
  }
  return data as T;
}
