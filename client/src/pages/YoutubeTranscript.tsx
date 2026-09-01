import { useState } from 'react';
import {
  fetchTranscript,
  LangNotAvailableError,
  type TranscriptResponse,
} from '../services/youtubeService';
import { saveAs } from '../utils/saveAs';
import YoutubeTabs from '../components/YoutubeTabs';

export default function YoutubeTranscript() {
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableLangs, setAvailableLangs] = useState<string[] | null>(null);
  const [data, setData] = useState<TranscriptResponse | null>(null);

  async function run(currentLang: string) {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAvailableLangs(null);
    setData(null);
    try {
      const res = await fetchTranscript(url.trim(), currentLang);
      setData(res);
    } catch (err) {
      if (err instanceof LangNotAvailableError) {
        setError(err.message);
        setAvailableLangs(err.availableLangs);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(lang.trim() || 'en');
  }

  function onPickLang(l: string) {
    setLang(l);
    run(l);
  }

  function onSave() {
    if (!data) return;
    saveAs(`youtube-${data.videoId}-${data.lang}.md`, data.markdown);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
          strumenti locali
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          YouTube Transcript
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Incolla l'URL di un video YouTube: il server recupera il transcript
          nella lingua scelta, lo formatta in Markdown con frontmatter Obsidian
          e paragrafi naturali, e lo mostra qui sotto. Da lì puoi salvarlo come
          file <code>.md</code> nel tuo vault.
        </p>
      </header>

      <YoutubeTabs />

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label
          htmlFor="yt-url"
          className="block text-sm font-medium text-neutral-700"
        >
          URL video
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="yt-url"
            type="url"
            inputMode="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <input
            id="yt-lang"
            type="text"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            placeholder="en"
            title="Codice lingua sottotitoli (es. en, it, en-US)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-24"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Scarico…' : 'Scarica transcript'}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Codice lingua sottotitoli (es. <code>en</code>, <code>it</code>,{' '}
          <code>en-US</code>). Default <code>en</code>.
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <p>{error}</p>
            {availableLangs && availableLangs.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-rose-700/80">Disponibili:</span>
                {availableLangs.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => onPickLang(l)}
                    className="rounded border border-rose-300 bg-white px-2 py-0.5 text-xs font-mono text-rose-700 transition hover:bg-rose-100"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {data && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Video {data.videoId} ·{' '}
                <span className="font-mono text-xs text-neutral-600">
                  {data.lang}
                </span>
              </p>
              <p className="text-xs text-neutral-500">
                {data.segments} segmenti ·{' '}
                {data.markdown.length.toLocaleString()} caratteri Markdown
              </p>
            </div>
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
            >
              Salva con nome…
            </button>
          </div>

          <textarea
            readOnly
            value={data.markdown}
            className="mt-5 h-96 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-neutral-800 focus:outline-none"
          />
        </section>
      )}
    </div>
  );
}
