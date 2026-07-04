import { API_URL } from '../utils/constants';

export interface TranscriptResponse {
  videoId: string;
  lang: string;
  segments: number;
  markdown: string;
}

// Lingua non disponibile: 422 con elenco delle lingue effettivamente presenti.
export class LangNotAvailableError extends Error {
  constructor(
    message: string,
    public availableLangs: string[]
  ) {
    super(message);
    this.name = 'LangNotAvailableError';
  }
}

export async function fetchTranscript(
  url: string,
  lang: string
): Promise<TranscriptResponse> {
  const response = await fetch(`${API_URL}/youtube/transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, lang }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 422 && Array.isArray(body.availableLangs)) {
    throw new LangNotAvailableError(
      body.error ?? 'Lingua non disponibile',
      body.availableLangs
    );
  }
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body as TranscriptResponse;
}
