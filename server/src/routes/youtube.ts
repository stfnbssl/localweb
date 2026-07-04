import { Router } from 'express';
import { YoutubeTranscript } from 'youtube-transcript';

const router = Router();

// Estrae l'ID di un video YouTube da forme URL comuni (watch?v=, youtu.be/, shorts/,
// embed/) oppure accetta direttamente un ID di 11 caratteri.
function extractVideoId(input: string): string | null {
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
function parseAvailableLangs(message: string): string[] | null {
  const m = message.match(/Available languages:\s*(.+?)\s*$/i);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickVariant(requested: string, available: string[]): string | null {
  if (available.includes(requested)) return requested;
  const base = requested.toLowerCase();
  return (
    available.find((l) => l.toLowerCase() === base) ??
    available.find((l) => l.toLowerCase().startsWith(`${base}-`)) ??
    null
  );
}

interface FetchResult {
  items: { text: string }[];
  lang: string;
}

async function fetchInLang(
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
    ) as Error & { availableLangs: string[]; status: number };
    error.availableLangs = available;
    error.status = 422;
    throw error;
  }
}

// Spezza un testo lineare in paragrafi di ~targetWords parole, andando a capo
// preferibilmente subito dopo una fine frase (. ! ?). Se nessun confine di frase
// è vicino entro maxWords, forza il break — così i captions auto-generati senza
// punteggiatura non producono un muro di testo.
function toMarkdownParagraphs(
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

function buildMarkdown(opts: {
  videoId: string;
  url: string;
  lang: string;
  segments: number;
  body: string;
}): string {
  const fetchedAt = new Date().toISOString();
  const videoUrl = `https://www.youtube.com/watch?v=${opts.videoId}`;
  return [
    '---',
    'source: youtube',
    `videoId: ${opts.videoId}`,
    `url: ${videoUrl}`,
    `lang: ${opts.lang}`,
    `segments: ${opts.segments}`,
    `fetchedAt: ${fetchedAt}`,
    '---',
    '',
    `# YouTube Transcript — ${opts.videoId}`,
    '',
    `[Apri su YouTube](${videoUrl})`,
    '',
    opts.body,
    '',
  ].join('\n');
}

router.post('/transcript', async (req, res) => {
  const { url, lang } = req.body ?? {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url è obbligatorio' });
  }
  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'URL o ID video non riconosciuto' });
  }

  // Default 'en': senza una lingua esplicita la libreria pesca il primo track
  // dell'elenco, che per molti video NON è quello originale.
  const requestedLang =
    typeof lang === 'string' && lang.trim() ? lang.trim() : 'en';

  try {
    const { items, lang: resolvedLang } = await fetchInLang(videoId, requestedLang);

    const raw = items
      .map((it) => it.text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');

    if (!raw) {
      return res
        .status(404)
        .json({ error: 'Nessun transcript disponibile per questo video' });
    }

    const body = toMarkdownParagraphs(raw);
    const markdown = buildMarkdown({
      videoId,
      url: url.trim(),
      lang: resolvedLang,
      segments: items.length,
      body,
    });

    res.json({
      videoId,
      lang: resolvedLang,
      segments: items.length,
      markdown,
    });
  } catch (err: any) {
    if (err?.status === 422 && Array.isArray(err.availableLangs)) {
      return res
        .status(422)
        .json({ error: err.message, availableLangs: err.availableLangs });
    }
    res.status(502).json({ error: err?.message ?? 'Recupero transcript fallito' });
  }
});

export default router;
