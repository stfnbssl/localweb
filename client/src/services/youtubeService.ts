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

// --- Canali ---

// 'ok' = markdown su disco; 'no-transcript' = il video non ha sottotitoli
// (stato definitivo, non si ritenta); 'error' = guasto ritentabile.
export type VideoStatus = 'ok' | 'no-transcript' | 'error';

export interface ChannelVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  url: string;
  status: VideoStatus | null; // null = mai incontrato prima
  requestedLang: string | null;
  lang: string | null;
  file: string | null;
  error: string | null;
  fetchedAt: string | null;
}

// 'data-api' = YouTube Data API v3 (serve API_KEY_YOUTUBE, nessun tetto)
// 'rss'      = feed pubblico del canale (nessuna chiave, ultimi 15 video)
export type ChannelSource = 'data-api' | 'rss';

export interface Capabilities {
  source: ChannelSource;
  dataApi: boolean;
  maxVideos: number;
  hardLimit: number | null; // non null solo quando il tetto è invalicabile
}

export interface ChannelListing {
  channelId: string;
  channelTitle: string | null;
  source: ChannelSource;
  feedLimit: number;
  videos: ChannelVideo[];
}

export interface KnownChannel {
  id: string;
  title: string | null;
  lastSyncAt: string;
  downloaded: number;
  known: number;
}

export interface SyncSummary {
  channelId: string;
  channelTitle: string | null;
  processed: number;
  downloaded: number;
  noTranscript: number;
  failed: number;
  source: ChannelSource;
  skipped: number; // già in archivio da un giro precedente
  beyondLimit: number; // rimasti fuori per via del limite: restano per il prossimo giro
  totalKnown: number;
  totalDownloaded: number;
  results: {
    id: string;
    title: string;
    status: VideoStatus;
    error: string | null;
  }[];
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error || `HTTP ${response.status}`);
  }
  return body as T;
}

export async function getCapabilities(): Promise<Capabilities> {
  return json(await fetch(`${API_URL}/youtube/capabilities`));
}

export async function listChannels(): Promise<KnownChannel[]> {
  return json(await fetch(`${API_URL}/youtube/channels`));
}

export async function listChannelVideos(
  q: string,
  max?: number
): Promise<ChannelListing> {
  const qs = new URLSearchParams({ q });
  if (max) qs.set('max', String(max));
  return json(await fetch(`${API_URL}/youtube/channel?${qs}`));
}

export async function syncChannel(opts: {
  channel: string;
  lang: string;
  max?: number; // quanti video elencare dal canale
  limit?: number; // quanti transcript scaricare in questo giro
  retryFailed?: boolean;
}): Promise<SyncSummary> {
  return json(
    await fetch(`${API_URL}/youtube/channel/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
  );
}

export async function readStoredTranscript(
  channelId: string,
  videoId: string
): Promise<ChannelVideo & { markdown: string }> {
  return json(
    await fetch(`${API_URL}/youtube/channel/${channelId}/video/${videoId}`)
  );
}
