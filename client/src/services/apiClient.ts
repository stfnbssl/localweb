import { API_URL } from '../utils/constants';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'Richiesta fallita' }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}
