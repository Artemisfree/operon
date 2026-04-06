export const COURIER_TOKEN_STORAGE_KEY = 'operon_courier_token';

export function loadToken(): string | null {
  return window.localStorage.getItem(COURIER_TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(COURIER_TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(COURIER_TOKEN_STORAGE_KEY);
}
