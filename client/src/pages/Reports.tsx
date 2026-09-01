import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listReports, type ReportSummary } from '../services/reportsService';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Reports() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listReports()
      .then(setReports)
      .catch((err: Error) => {
        setError(err.message);
        setReports([]);
      });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Reports
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Corpus analizzati, uno per canale, trovati in{' '}
          <code className="text-sm text-neutral-700">
            reports/youtube/&lt;canale&gt;/synthesis.json
          </code>
          . Li mostra un unico visualizzatore HTML a sé stante, che il server
          serve così com’è.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {reports === null && (
        <p className="text-sm text-neutral-500">Lettura dell’archivio…</p>
      )}

      {reports !== null && reports.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-neutral-600">Nessun report presente.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Un report compare qui appena esiste un file{' '}
            <code>synthesis.json</code> in{' '}
            <code>reports/youtube/&lt;canale&gt;/</code>.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {(reports ?? []).map((r) => (
          <li key={r.channelId}>
            <Link
              to={`/reports/${r.channelId}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <p className="text-base font-medium text-neutral-900">{r.title}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {r.channelTitle ?? 'canale senza titolo in archivio'}
              </p>
              <p className="mt-3 text-xs text-neutral-500">
                <code className="text-neutral-600">{r.channelId}</code> ·{' '}
                {formatSize(r.sizeBytes)} · aggiornato il {formatDate(r.updatedAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
