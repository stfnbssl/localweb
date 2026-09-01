import { Router } from 'express';
import {
  extractVideoId,
  buildTranscriptMarkdown,
  isLangNotAvailable,
} from '../youtube/transcript';
import { isChannelId, RSS_FEED_LIMIT } from '../youtube/feed';
import {
  listChannelVideos,
  DEFAULT_MAX_VIDEOS,
  type ChannelListing,
} from '../youtube/channel';
import { hasApiKey } from '../youtube/dataApi';
import {
  videoStore,
  upsertVideo,
  upsertChannel,
  channels,
  markdownFileName,
  saveTranscriptFile,
  readTranscriptFile,
  type StoredVideo,
} from '../youtube/store';

const router = Router();

// --- Transcript di un singolo video (nessuna persistenza: risposta al volo) ---
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
    const result = await buildTranscriptMarkdown({
      videoId,
      lang: requestedLang,
    });
    res.json(result);
  } catch (err: any) {
    if (isLangNotAvailable(err)) {
      return res
        .status(422)
        .json({ error: err.message, availableLangs: err.availableLangs });
    }
    if (err?.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    res.status(502).json({ error: err?.message ?? 'Recupero transcript fallito' });
  }
});

// Quanti video chiedere al canale. Senza Data API il feed ne dà comunque 15,
// quindi il parametro conta solo quando la chiave c'è.
function parseMax(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_VIDEOS;
  return Math.min(Math.floor(n), 500);
}

// --- Da quale sorgente arrivano gli elenchi, e con quale tetto ---
router.get('/capabilities', (_req, res) => {
  const dataApi = hasApiKey();
  res.json({
    source: dataApi ? 'data-api' : 'rss',
    dataApi,
    // Senza chiave il tetto è del feed ed è invalicabile; con la chiave è solo
    // il default proposto, alzabile dal client.
    maxVideos: dataApi ? DEFAULT_MAX_VIDEOS : RSS_FEED_LIMIT,
    hardLimit: dataApi ? null : RSS_FEED_LIMIT,
  });
});

// --- Canali già sincronizzati ---
router.get('/channels', async (_req, res) => {
  const all = await channels.readAll();
  const withCounts = await Promise.all(
    all.map(async (c) => {
      const videos = await videoStore(c.id).readAll();
      return {
        ...c,
        downloaded: videos.filter((v) => v.status === 'ok').length,
        known: videos.length,
      };
    })
  );
  withCounts.sort((a, b) => b.lastSyncAt.localeCompare(a.lastSyncAt));
  res.json(withCounts);
});

// --- Elenco dei video del canale, con lo stato di ciascuno ---
// Quanti se ne ottengono dipende dalla sorgente: 15 fissi col feed RSS, `max`
// con la Data API. La risposta dichiara quale delle due ha risposto.
router.get('/channel', async (req, res) => {
  const input = String(req.query.q ?? '').trim();
  if (!input) return res.status(400).json({ error: 'q è obbligatorio' });

  try {
    const listing = await listChannelVideos(input, parseMax(req.query.max));
    const { channelId, videos } = listing;
    const known = new Map(
      (await videoStore(channelId).readAll()).map((v) => [v.id, v])
    );

    res.json({
      channelId,
      channelTitle: listing.channelTitle,
      // Sorgente e tetto vengono dichiarati al client perché possa spiegarli
      // all'utente invece di far sembrare il numero di video una scelta arbitraria.
      source: listing.source,
      feedLimit: listing.limit,
      videos: videos.map((v) => {
        const state = known.get(v.videoId);
        return {
          ...v,
          status: state?.status ?? null,
          requestedLang: state?.requestedLang ?? null,
          lang: state?.lang ?? null,
          file: state?.file ?? null,
          error: state?.error ?? null,
          fetchedAt: state?.fetchedAt ?? null,
        };
      }),
    });
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'Lettura del canale fallita' });
  }
});

// Pausa fra un video e l'altro: le richieste all'endpoint timedtext partono
// tutte dallo stesso IP e in raffica fanno scattare blocchi temporanei.
const PAUSE_MS = Number(process.env.YOUTUBE_PAUSE_MS) || 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Scarica i transcript mancanti del canale ---
router.post('/channel/sync', async (req, res) => {
  const { channel: input, lang, limit, retryFailed } = req.body ?? {};
  if (typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({ error: 'channel è obbligatorio' });
  }
  const requestedLang =
    typeof lang === 'string' && lang.trim() ? lang.trim() : 'en';
  // Due limiti distinti, che con la Data API smettono di coincidere:
  //  - `max`   quanti video ELENCARE dal canale (fin dove risalire indietro);
  //  - `limit` quanti transcript SCARICARE in questo giro.
  // Il secondo esiste perché ogni transcript costa una richiesta più una pausa:
  // 100 video sono diversi minuti con la richiesta HTTP aperta.
  const batchSize =
    Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 100) : RSS_FEED_LIMIT;

  let listing: ChannelListing;
  try {
    listing = await listChannelVideos(input.trim(), parseMax(req.body?.max));
  } catch (err: any) {
    return res
      .status(502)
      .json({ error: err?.message ?? 'Lettura del canale fallita' });
  }
  const { channelId, channelTitle, videos: feedVideos } = listing;

  const known = new Map(
    (await videoStore(channelId).readAll()).map((v) => [v.id, v])
  );

  // Il cuore dell'incrementale: si saltano i video già trattati. Cosa si ritenta
  // dipende dal perché era fallito — vedi i tre rami qui sotto.
  const candidates = feedVideos.filter((v) => {
    const state = known.get(v.videoId);
    if (!state) return true;
    if (state.status === 'ok') return false;
    // Un 'no-transcript' è definitivo solo per la lingua con cui è stato
    // registrato: chiedendone un'altra vale la pena riprovare.
    if (state.status === 'no-transcript') return state.requestedLang !== requestedLang;
    return state.status === 'error' && Boolean(retryFailed);
  });
  const todo = candidates.slice(0, batchSize);

  const done: StoredVideo[] = [];
  for (const [i, video] of todo.entries()) {
    // Serializzato di proposito, non in Promise.all: vedi PAUSE_MS.
    if (i > 0) await sleep(PAUSE_MS);

    const base = {
      id: video.videoId,
      channelId,
      title: video.title,
      publishedAt: video.publishedAt,
      requestedLang,
      fetchedAt: new Date().toISOString(),
    };

    try {
      const result = await buildTranscriptMarkdown({
        videoId: video.videoId,
        lang: requestedLang,
        title: video.title,
        channelTitle,
        publishedAt: video.publishedAt,
      });
      const file = await saveTranscriptFile(
        channelId,
        markdownFileName(video),
        result.markdown
      );
      done.push(
        await upsertVideo(channelId, {
          ...base,
          status: 'ok',
          lang: result.lang,
          segments: result.segments,
          file,
          error: null,
        })
      );
    } catch (err: any) {
      // Un video senza sottotitoli non è un guasto: è un fatto sul video, e va
      // registrato come tale perché il prossimo giro non lo ritenti.
      const definitive = isLangNotAvailable(err) || err?.status === 404;
      done.push(
        await upsertVideo(channelId, {
          ...base,
          status: definitive ? 'no-transcript' : 'error',
          lang: null,
          segments: null,
          file: null,
          error: err?.message ?? 'errore sconosciuto',
        })
      );
    }
  }

  await upsertChannel(channelId, channelTitle);

  const all = await videoStore(channelId).readAll();
  res.json({
    channelId,
    channelTitle,
    source: listing.source,
    processed: done.length,
    downloaded: done.filter((v) => v.status === 'ok').length,
    noTranscript: done.filter((v) => v.status === 'no-transcript').length,
    failed: done.filter((v) => v.status === 'error').length,
    // Due motivi diversi per non aver trattato un video, tenuti distinti perché
    // dicono cose opposte: `skipped` è lavoro già fatto in passato,
    // `beyondLimit` è lavoro che resta da fare al prossimo giro.
    skipped: feedVideos.length - candidates.length,
    beyondLimit: candidates.length - todo.length,
    totalKnown: all.length,
    totalDownloaded: all.filter((v) => v.status === 'ok').length,
    results: done,
  });
});

// --- Rilegge dal disco un transcript già scaricato ---
router.get('/channel/:channelId/video/:videoId', async (req, res) => {
  const { channelId, videoId } = req.params;
  if (!isChannelId(channelId)) {
    return res.status(400).json({ error: 'channelId non valido' });
  }
  const record = await videoStore(channelId).findById(videoId);
  if (!record || !record.file) {
    return res.status(404).json({ error: 'Transcript non presente in archivio' });
  }
  try {
    const markdown = await readTranscriptFile(record.file);
    res.json({ ...record, markdown });
  } catch {
    res.status(404).json({ error: 'File del transcript non trovato su disco' });
  }
});

export default router;
