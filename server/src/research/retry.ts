// Retry con backoff esponenziale + jitter (analogo a utils/retry.py dell'analisi).
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {}
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 500, timeoutMs = 15000 } = options;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      // Riprova su errori server / rate limit.
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === maxRetries) break;
      const delay =
        baseDelayMs * 2 ** attempt + Math.floor(Math.random() * baseDelayMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
