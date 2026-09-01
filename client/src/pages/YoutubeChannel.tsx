import { useEffect, useState } from 'react';
import {
  getCapabilities,
  listChannels,
  listChannelVideos,
  syncChannel,
  readStoredTranscript,
  type Capabilities,
  type ChannelListing,
  type ChannelVideo,
  type KnownChannel,
  type SyncSummary,
  type VideoStatus,
} from '../services/youtubeService';
import { saveAs } from '../utils/saveAs';
import YoutubeTabs from '../components/YoutubeTabs';

const STATUS_LABEL: Record<VideoStatus, string> = {
  ok: 'scaricato',
  'no-transcript': 'senza sottotitoli',
  error: 'errore',
};

const STATUS_CLASS: Record<VideoStatus, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'no-transcript': 'bg-slate-100 text-neutral-600 border-slate-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function YoutubeChannel() {
  const [channel, setChannel] = useState('');
  const [lang, setLang] = useState('en');
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [max, setMax] = useState(15);
  const [listing, setListing] = useState<ChannelListing | null>(null);
  const [known, setKnown] = useState<KnownChannel[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [busy, setBusy] = useState<'list' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshKnown() {
    try {
      setKnown(await listChannels());
    } catch {
      /* l'elenco dei canali noti è un di più: se fallisce non blocca la pagina */
    }
  }

  useEffect(() => {
    refreshKnown();
    getCapabilities()
      .then((c) => {
        setCaps(c);
        setMax(c.maxVideos);
      })
      .catch(() => {
        /* senza capabilities la pagina resta usabile con i default */
      });
  }, []);

  async function onList(value?: string) {
    const q = (value ?? channel).trim();
    if (!q || busy) return;
    setChannel(q);
    setBusy('list');
    setError(null);
    setSummary(null);
    try {
      setListing(await listChannelVideos(q, max));
    } catch (err) {
      setError((err as Error).message);
      setListing(null);
    } finally {
      setBusy(null);
    }
  }

  async function onSync(retryFailed: boolean) {
    const q = channel.trim();
    if (!q || busy) return;
    setBusy('sync');
    setError(null);
    try {
      const res = await syncChannel({
        channel: q,
        lang: lang.trim() || 'en',
        max,
        retryFailed,
      });
      setSummary(res);
      // Ricarica l'elenco per mostrare i nuovi stati accanto ai video.
      setListing(await listChannelVideos(q, max));
      await refreshKnown();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onDownload(video: ChannelVideo) {
    if (!listing) return;
    try {
      const stored = await readStoredTranscript(listing.channelId, video.videoId);
      saveAs(`${video.videoId}-${stored.lang ?? 'txt'}.md`, stored.markdown);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const pending = listing?.videos.filter((v) => v.status === null).length ?? 0;
  const failed = listing?.videos.filter((v) => v.status === 'error').length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
          strumenti locali
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Transcript di un canale
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Incolla l'indirizzo di un canale: il server legge il feed pubblico e
          scarica i transcript mancanti, salvandoli in{' '}
          <code>data/youtube/</code>. Lo stato di ogni video resta in archivio,
          quindi un rilancio scarica <strong>solo i video nuovi</strong>.
        </p>
      </header>

      <YoutubeTabs />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onList();
        }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label htmlFor="yt-channel" className="block text-sm font-medium text-neutral-700">
          Canale
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="yt-channel"
            type="text"
            required
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="@nomecanale, oppure https://www.youtube.com/channel/UC…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <input
            type="text"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            placeholder="en"
            title="Codice lingua sottotitoli (es. en, it, en-US)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-24"
          />
          {caps?.dataApi && (
            <input
              type="number"
              min={1}
              max={500}
              value={max}
              onChange={(e) => setMax(Math.max(1, Number(e.target.value) || 1))}
              title="Quanti video risalire indietro nella cronologia del canale"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-24"
            />
          )}
          <button
            type="submit"
            disabled={busy !== null || !channel.trim()}
            className="rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'list' ? 'Leggo…' : 'Elenca video'}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {caps?.dataApi ? (
            <>
              Sorgente: <strong>YouTube Data API</strong> — puoi risalire indietro
              nella cronologia quanto vuoi (il campo numerico dice fin dove). Costa
              1 unità di quota ogni 50 video, su 10.000 al giorno.
            </>
          ) : (
            <>
              Sorgente: <strong>feed pubblico</strong> — espone gli{' '}
              <strong>ultimi 15 video</strong> e non è paginabile. Per risalire più
              indietro serve una chiave <code>API_KEY_YOUTUBE</code> in{' '}
              <code>server/.env</code>.
            </>
          )}
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </form>

      {known.length > 0 && !listing && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Canali già sincronizzati
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {known.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onList(c.id)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-neutral-700 transition hover:border-primary-300 hover:bg-primary-50"
              >
                {c.title ?? c.id}{' '}
                <span className="text-neutral-400">· {c.downloaded} scaricati</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {listing && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                {listing.channelTitle ?? listing.channelId}
              </h2>
              <p className="text-xs text-neutral-500">
                <span className="font-mono">{listing.channelId}</span> ·{' '}
                {listing.videos.length} video nel feed · {pending} da scaricare
              </p>
            </div>
            <div className="flex gap-2">
              {failed > 0 && (
                <button
                  type="button"
                  onClick={() => onSync(true)}
                  disabled={busy !== null}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-neutral-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ritenta {failed} falliti
                </button>
              )}
              <button
                type="button"
                onClick={() => onSync(false)}
                disabled={busy !== null || pending === 0}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'sync'
                  ? 'Scarico…'
                  : pending === 0
                    ? 'Tutto già scaricato'
                    : `Scarica ${pending} mancanti`}
              </button>
            </div>
          </div>

          {busy === 'sync' && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-neutral-600">
              Scarico un video alla volta con una pausa fra l'uno e l'altro, per non
              farmi bloccare da YouTube: con {pending} video mancanti servono circa{' '}
              {Math.max(1, Math.round((pending * 2.5) / 60))} minuti.
            </p>
          )}

          {summary && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <span className="font-semibold">{summary.downloaded} scaricati.</span>{' '}
              {summary.skipped > 0 && `${summary.skipped} già in archivio. `}
              {summary.beyondLimit > 0 &&
                `${summary.beyondLimit} rimasti per il prossimo giro. `}
              {summary.noTranscript > 0 && `${summary.noTranscript} senza sottotitoli. `}
              {summary.failed > 0 && `${summary.failed} falliti. `}
              Totale in archivio per questo canale: {summary.totalDownloaded}.
            </p>
          )}

          <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {listing.videos.map((v) => (
              <li key={v.videoId} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-neutral-900 hover:text-primary-700"
                    title={v.title}
                  >
                    {v.title}
                  </a>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {formatDate(v.publishedAt)}
                    {v.lang && ` · ${v.lang}`}
                    {v.error && ` · ${v.error}`}
                  </p>
                </div>

                {v.status ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[v.status]}`}
                  >
                    {STATUS_LABEL[v.status]}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-neutral-400">
                    da scaricare
                  </span>
                )}

                {v.status === 'ok' && (
                  <button
                    type="button"
                    onClick={() => onDownload(v)}
                    className="rounded-md border border-primary-600 px-3 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-50"
                  >
                    Salva .md
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
