// Punto unico da cui il resto dell'app chiede "quali video ha questo canale".
// Nasconde quale delle due sorgenti sia in uso:
//
//  - Data API v3, se API_KEY_YOUTUBE è configurata: nessun tetto, l'handle si
//    risolve senza scraping, ma consuma quota;
//  - feed RSS pubblico, altrimenti: zero configurazione, ultimi 15 video.
//
// Il fallback non è un ripiego d'emergenza ma una scelta: senza chiave l'app
// deve continuare a funzionare, perché è così che è nata.

import { fetchChannelFeed, resolveChannelId, RSS_FEED_LIMIT } from './feed';
import { hasApiKey, resolveChannel, listUploads } from './dataApi';
import type { FeedVideo } from './feed';

export type ChannelSource = 'data-api' | 'rss';

export interface ChannelListing {
  channelId: string;
  channelTitle: string | null;
  source: ChannelSource;
  // Tetto effettivo dei video ottenibili: 15 con RSS, `max` con la Data API.
  limit: number;
  videos: FeedVideo[];
}

export const DEFAULT_MAX_VIDEOS = 50;

export async function listChannelVideos(
  input: string,
  max: number = DEFAULT_MAX_VIDEOS
): Promise<ChannelListing> {
  if (hasApiKey()) {
    const channel = await resolveChannel(input);
    const videos = await listUploads(channel.uploadsPlaylistId, max);
    return {
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      source: 'data-api',
      limit: max,
      videos,
    };
  }

  const channelId = await resolveChannelId(input);
  const { channel, videos } = await fetchChannelFeed(channelId);
  return {
    channelId,
    channelTitle: channel.channelTitle,
    source: 'rss',
    limit: RSS_FEED_LIMIT,
    videos,
  };
}
