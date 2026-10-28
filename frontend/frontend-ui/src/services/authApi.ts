/**
 * AICTE Backend Auth API Service
 * Handles real authentication against the Express backend.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api';
const TOKEN_KEY = 'aicte_auth_token';
const USER_KEY = 'aicte_auth_user';

let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedHandler(callback: () => void) {
  onUnauthorizedCallback = callback;
}

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  bureau?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getStoredToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Unable to connect to the backend server. Please verify the API is running.');
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (response.status === 401) {
    clearSession();
    if (typeof onUnauthorizedCallback === 'function') {
      onUnauthorizedCallback();
    }
    const typedData = data as Record<string, unknown> | null;
    const msg =
      (typedData?.error as Record<string, string>)?.message ||
      'Session expired or invalid credentials. Please log in again.';
    throw Object.assign(new Error(msg), { code: 'UNAUTHORIZED', status: 401 });
  }

  if (!response.ok) {
    const typedData = data as Record<string, unknown> | null;
    const msg =
      (typedData?.error as Record<string, string>)?.message ||
      `Request failed with status ${response.status}`;
    throw Object.assign(new Error(msg), { code: 'REQUEST_FAILED', status: response.status });
  }

  return data as T;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const payload = await request<{ success: boolean; data: { token: string; user: AuthUser } }>(
    '/v1/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  );
  if (payload?.success && payload?.data?.token) {
    storeSession(payload.data.token, payload.data.user);
    return payload.data.user;
  }
  throw new Error('Invalid response format received from authentication server.');
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const payload = await request<{ success: boolean; data: AuthUser }>('/v1/auth/me');
  if (payload?.success && payload?.data) {
    return payload.data;
  }
  return null;
}

export async function checkHealth(): Promise<{ message: string }> {
  return request<{ message: string }>('/health');
}
