const BASE_URL = import.meta.env.VITE_API_URL || '';

type TokenListener = (accessToken: string | null) => void;
const tokenListeners = new Set<TokenListener>();

function notifyTokenChange(accessToken: string | null) {
  tokenListeners.forEach(listener => listener(accessToken));
}

export function subscribeTokenChange(listener: TokenListener) {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

export function getAccessToken() {
  return sessionStorage.getItem('accessToken') || sessionStorage.getItem('token');
}

export function getRefreshToken() {
  return sessionStorage.getItem('refreshToken');
}

export function setTokens(accessToken: string, refreshToken?: string) {
  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('token', accessToken);
  if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
  notifyTokenChange(accessToken);
}

export function clearTokens() {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('token');
  notifyTokenChange(null);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function request<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, false);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
  return data as T;
}

export const api = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  get: <T>(path: string) => request<T>(path),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
