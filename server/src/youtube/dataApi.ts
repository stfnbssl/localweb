// Elenco dei video di un canale via YouTube Data API v3.
//
// Rispetto al feed RSS costa una API key, ma toglie il tetto dei 15 video:
// si pagina all'indietro nella cronologia quanto si vuole.
//
// Il percorso è channels.list → playlist "uploads" → playlistItems.list, non
// search.list: a unità costerebbero uguale (1 ciascuna), ma search.list ha un
// budget separato di sole 100 chiamate al giorno, mentre gli altri endpoint
// attingono alle 10.000 unità giornaliere. Un canale da 500 video costa 11 unità.

import type { FeedVideo } from './feed';

const API = 'https://www.googleapis.com/youtube/v3';

export function apiKey(): string | null {
  const key = process.env.API_KEY_YOUTUBE?.trim();
  return key ? key : null;
}

export function hasApiKey(): boolean {
  return apiKey() !== null;
}

interface ApiError {
  error?: { code?: number; message?: string; errors?: { reason?: string }[] };
}

// Traduce gli errori della Data API in messaggi che dicono all'utente cosa fare.
// Il messaggio grezzo di Google è lungo e parla di "consumer" e "project".
async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('API_KEY_YOUTUBE non configurata in server/.env');

  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${path}?${qs}`);
  const body = (await res.json().catch(() => ({}))) as T & ApiError;

  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason ?? '';
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new Error(
        'Quota giornaliera della YouTube Data API esaurita: riprova dopo il reset (mezzanotte Pacific Time) oppure rimuovi API_KEY_YOUTUBE per usare il feed RSS.'
      );
    }
    if (reason === 'keyInvalid' || reason === 'badRequest') {
      throw new Error(
        'La API key di YouTube non è valida: controlla API_KEY_YOUTUBE in server/.env.'
      );
    }
    if (res.status === 403) {
      throw new Error(
        `YouTube Data API ha rifiutato la richiesta (${reason || 'accesso negato'}): verifica che "YouTube Data API v3" sia abilitata sul progetto e che le restrizioni della chiave la consentano.`
      );
    }
    throw new Error(
      body.error?.message ?? `YouTube Data API ha risposto HTTP ${res.status}`
    );
  }
  return body;
}

interface ChannelsResponse {
  items?: {
    id: string;
    snippet?: { title?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

export interface ChannelHandle {
  channelId: string;
  channelTitle: string | null;
  uploadsPlaylistId: string;
}

/**
 * Risolve il canale e restituisce anche la playlist "uploads", che è ciò che
 * serve per elencare i video. Accetta l'id nudo (UC…), un URL /channel/UC…,
 * un handle (@nome) o un vecchio username.
 *
 * A differenza del feed RSS, qui l'handle si risolve **senza scraping**:
 * channels.list ha il parametro forHandle apposta.
 */
export async function resolveChannel(input: string): Promise<ChannelHandle> {
  const raw = input.trim();
  const params: Record<string, string> = { part: 'snippet,contentDetails' };

  const direct = raw.match(/(UC[A-Za-z0-9_-]{22})/);
  if (direct) {
    params.id = direct[1];
  } else {
    // Dagli URL si tiene solo l'ultimo segmento: /@nome, /c/nome, /user/nome.
    const segment = raw.replace(/\/+$/, '').split('/').pop() ?? raw;
    params.forHandle = segment.startsWith('@') ? segment : `@${segment}`;
  }

  let data = await call<ChannelsResponse>('channels', params);

  // I canali molto vecchi possono avere solo lo username legacy e nessun handle.
  if (!data.items?.length && params.forHandle) {
    const username = params.forHandle.slice(1);
    data = await call<ChannelsResponse>('channels', {
      part: 'snippet,contentDetails',
      forUsername: username,
    });
  }

  const item = data.items?.[0];
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!item || !uploads) {
    throw new Error(`Nessun canale YouTube trovato per "${raw}"`);
  }

  return {
    channelId: item.id,
    channelTitle: item.snippet?.title ?? null,
    uploadsPlaylistId: uploads,
  };
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items?: {
    snippet?: { title?: string };
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
  }[];
}

const PAGE_SIZE = 50; // massimo consentito dall'API

/**
 * Scorre la playlist "uploads" dal video più recente all'indietro, fino a `max`.
 * Una chiamata (1 unità) ogni 50 video.
 */
export async function listUploads(
  uploadsPlaylistId: string,
  max: number
): Promise<FeedVideo[]> {
  const videos: FeedVideo[] = [];
  let pageToken: string | undefined;

  while (videos.length < max) {
    const data: PlaylistItemsResponse = await call('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(PAGE_SIZE, max - videos.length)),
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      // I video privati o cancellati restano nella playlist come segnaposto,
      // senza data di pubblicazione: non sono scaricabili, si scartano.
      if (!videoId || !item.contentDetails?.videoPublishedAt) continue;
      videos.push({
        videoId,
        title: item.snippet?.title ?? '(senza titolo)',
        // videoPublishedAt è la pubblicazione del VIDEO; snippet.publishedAt
        // sarebbe la data di aggiunta alla playlist, che può differire.
        publishedAt: item.contentDetails.videoPublishedAt,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return videos.slice(0, max);
}
