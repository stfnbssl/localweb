import fs from 'fs/promises';
import { JsonlStore, youtubePath, writeTextFile } from '../research/storage';
// slugify è un'utility di testo generica, finita per prima in research/: la si
// importa invece di duplicarla.
import { slugify } from '../research/markdown';
import { isChannelId } from './feed';

// Esito del tentativo di scaricare un transcript.
//  - 'ok'            → markdown salvato su disco
//  - 'no-transcript' → il video non ha sottotitoli nella lingua richiesta: è uno
//                      stato definitivo, un rilancio non lo ritenta
//  - 'error'         → guasto potenzialmente transitorio (rete, blocco
//                      temporaneo): ritentabile su richiesta
export type VideoStatus = 'ok' | 'no-transcript' | 'error';

export interface StoredVideo {
  id: string; // videoId — è la chiave dello store
  channelId: string;
  title: string;
  publishedAt: string;
  status: VideoStatus;
  // Lingua CHIESTA al momento del tentativo. Serve a non trascinare per sempre
  // un 'no-transcript': un video privo di sottotitoli in inglese può averli in
  // italiano, quindi lo stato è definitivo solo per la lingua con cui è nato.
  requestedLang: string;
  // Lingua effettivamente OTTENUTA (può essere una variante: en → en-US).
  lang: string | null;
  segments: number | null;
  file: string | null; // path del .md relativo a data/youtube/
  error: string | null;
  fetchedAt: string;
}

export interface StoredChannel {
  id: string; // channelId
  title: string | null;
  lastSyncAt: string;
}

// Registro dei canali visti, per riproporli nella UI senza doverli reincollare.
export const channels = new JsonlStore<StoredChannel>('channels.jsonl', youtubePath);

// Un indice per canale: tenerli separati evita di riscrivere un file unico che
// cresce con tutti i canali a ogni update.
export function videoStore(channelId: string): JsonlStore<StoredVideo> {
  // Il channelId finisce in un path: senza questo controllo un valore ostile
  // ("../..") uscirebbe dalla cartella dei dati.
  if (!isChannelId(channelId)) {
    throw new Error(`channelId non valido: ${channelId}`);
  }
  return new JsonlStore<StoredVideo>(`${channelId}/index.jsonl`, youtubePath);
}

// Nome file leggibile in un vault Obsidian: data, titolo, id.
// L'id in coda garantisce l'unicità anche fra due video omonimi.
export function markdownFileName(video: {
  videoId: string;
  title: string;
  publishedAt: string;
}): string {
  const date = (video.publishedAt || '').slice(0, 10) || 'senza-data';
  return `${date}-${slugify(video.title)}-${video.videoId}.md`;
}

export async function saveTranscriptFile(
  channelId: string,
  fileName: string,
  markdown: string
): Promise<string> {
  if (!isChannelId(channelId)) {
    throw new Error(`channelId non valido: ${channelId}`);
  }
  const relative = `${channelId}/${fileName}`;
  await writeTextFile(youtubePath(relative), markdown);
  return relative;
}

export async function readTranscriptFile(relativePath: string): Promise<string> {
  return fs.readFile(youtubePath(relativePath), 'utf8');
}

// Inserisce o aggiorna il record di un video (JsonlStore.append non fa upsert).
export async function upsertVideo(
  channelId: string,
  record: StoredVideo
): Promise<StoredVideo> {
  const store = videoStore(channelId);
  const existing = await store.findById(record.id);
  if (existing) {
    return (await store.update(record.id, record)) ?? record;
  }
  return store.append(record);
}

export async function upsertChannel(
  channelId: string,
  title: string | null
): Promise<StoredChannel> {
  const record: StoredChannel = {
    id: channelId,
    title,
    lastSyncAt: new Date().toISOString(),
  };
  const existing = await channels.findById(channelId);
  if (existing) {
    return (await channels.update(channelId, record)) ?? record;
  }
  return channels.append(record);
}
