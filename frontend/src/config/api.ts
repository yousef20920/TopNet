const defaultApiBaseUrl = 'http://localhost:3001';

export const API_ORIGIN =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? defaultApiBaseUrl;

export const API_BASE = `${API_ORIGIN}/api`;
