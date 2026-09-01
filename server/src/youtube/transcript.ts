import { YoutubeTranscript } from 'youtube-transcript';

// Recupero e formattazione del transcript di un singolo video. Vive qui, e non
// più dentro la route, perché ora ha due chiamanti: il download singolo e la
// sincronizzazione di un canale.

// Estrae l'ID di un video YouTube da forme URL comuni (watch?v=, youtu.be/, shorts/,
// embed/) oppure accetta direttamente un ID di 11 caratteri.
export function extractVideoId(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* non è un URL valido */
  }
  return null;
}

// La libreria solleva un errore con il messaggio
//   "...Available languages: en-US, nl, de"
// quando la lingua richiesta non esiste. Estraiamo l'elenco per:
//  - tentare automaticamente una variante (es. `en` → `en-US`),
//  - restituirlo al client come quick-pick.
export function parseAvailableLangs(message: string): string[] | null {
  const m = message.match(/Available languages:\s*(.+?)\s*$/i);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pickVariant(requested: string, available: string[]): string | null {
  if (available.includes(requested)) return requested;
  const base = requested.toLowerCase();
  return (
    available.find((l) => l.toLowerCase() === base) ??
    available.find((l) => l.toLowerCase().startsWith(`${base}-`)) ??
    null
  );
}

export interface LangNotAvailable extends Error {
  availableLangs: string[];
  status: number;
}

export function isLangNotAvailable(err: unknown): err is LangNotAvailable {
  return (
    !!err &&
    (err as LangNotAvailable).status === 422 &&
    Array.isArray((err as LangNotAvailable).availableLangs)
  );
}

interface FetchResult {
  items: { text: string }[];
  lang: string;
}

export async function fetchInLang(
  videoId: string,
  requestedLang: string
): Promise<FetchResult> {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: requestedLang,
    });
    return { items, lang: requestedLang };
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    const available = parseAvailableLangs(msg);
    if (!available) throw err;

    const variant = pickVariant(requestedLang, available);
    if (variant && variant !== requestedLang) {
      const items = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: variant,
      });
      return { items, lang: variant };
    }

    const error = new Error(
      `Lingua "${requestedLang}" non disponibile per questo video`
    ) as LangNotAvailable;
    error.availableLangs = available;
    error.status = 422;
    throw error;
  }
}

// Spezza un testo lineare in paragrafi di ~targetWords parole, andando a capo
// preferibilmente subito dopo una fine frase (. ! ?). Se nessun confine di frase
// è vicino entro maxWords, forza il break — così i captions auto-generati senza
// punteggiatura non producono un muro di testo.
export function toMarkdownParagraphs(
  text: string,
  targetWords = 80,
  maxWords = 120
): string {
  const words = text.split(/\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  for (const w of words) {
    buffer.push(w);
    const len = buffer.length;
    const endsSentence = /[.!?…]["')\]]?$/.test(w);
    if ((len >= targetWords && endsSentence) || len >= maxWords) {
      paragraphs.push(buffer.join(' '));
      buffer = [];
    }
  }
  if (buffer.length > 0) paragraphs.push(buffer.join(' '));
  return paragraphs.join('\n\n');
}

export function buildMarkdown(opts: {
  videoId: string;
  lang: string;
  segments: number;
  body: string;
  title?: string | null;
  channelTitle?: string | null;
  publishedAt?: string | null;
}): string {
  const fetchedAt = new Date().toISOString();
  const videoUrl = `https://www.youtube.com/watch?v=${opts.videoId}`;
  const front = [
    '---',
    'source: youtube',
    `videoId: ${opts.videoId}`,
    `url: ${videoUrl}`,
    `lang: ${opts.lang}`,
    `segments: ${opts.segments}`,
    `fetchedAt: ${fetchedAt}`,
  ];
  // I campi dal feed del canale ci sono solo nel flusso "sincronizza canale":
  // nel download di un singolo video non abbiamo titolo né data.
  if (opts.title) front.push(`title: ${JSON.stringify(opts.title)}`);
  if (opts.channelTitle) front.push(`channel: ${JSON.stringify(opts.channelTitle)}`);
  if (opts.publishedAt) front.push(`publishedAt: ${opts.publishedAt}`);
  front.push('---');

  return [
    ...front,
    '',
    `# ${opts.title ? opts.title : `YouTube Transcript — ${opts.videoId}`}`,
    '',
    `[Apri su YouTube](${videoUrl})`,
    '',
    opts.body,
    '',
  ].join('\n');
}

export interface TranscriptMarkdown {
  videoId: string;
  lang: string;
  segments: number;
  markdown: string;
}

// Percorso completo: transcript → testo unito → paragrafi → Markdown.
// Solleva un errore se il video non ha alcun testo utilizzabile.
export async function buildTranscriptMarkdown(opts: {
  videoId: string;
  lang: string;
  title?: string | null;
  channelTitle?: string | null;
  publishedAt?: string | null;
}): Promise<TranscriptMarkdown> {
  const { items, lang: resolvedLang } = await fetchInLang(opts.videoId, opts.lang);

  const raw = items
    .map((it) => it.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');

  if (!raw) {
    const err = new Error('Nessun transcript disponibile per questo video') as Error & {
      status: number;
    };
    err.status = 404;
    throw err;
  }

  return {
    videoId: opts.videoId,
    lang: resolvedLang,
    segments: items.length,
    markdown: buildMarkdown({
      videoId: opts.videoId,
      lang: resolvedLang,
      segments: items.length,
      body: toMarkdownParagraphs(raw),
      title: opts.title,
      channelTitle: opts.channelTitle,
      publishedAt: opts.publishedAt,
    }),
  };
}
