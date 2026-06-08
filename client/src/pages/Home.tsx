import { Link } from 'react-router-dom';
import { usePing } from '../hooks/usePing';
import StatusDot from '../components/StatusDot';
import { APP_NAME } from '../utils/constants';

export default function Home() {
  const { data, error, isFetching, refetch, status } = usePing();

  const statusLabel =
    status === 'ok'
      ? 'Server connesso'
      : status === 'error'
        ? 'Server non raggiungibile'
        : 'Verifica in corso…';

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
          ambiente locale
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">
          Gestione di file Markdown e JSON in locale, con esecuzione di lavori
          su Claude&nbsp;Cowork e Claude&nbsp;Code.
        </p>
      </header>

      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <StatusDot status={status} />
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {statusLabel}
              </p>
              <p className="text-xs text-neutral-500">
                Endpoint <code className="text-neutral-700">/api/ping</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFetching ? 'Ping…' : 'Esegui PING'}
          </button>
        </div>

        <div className="mt-5 rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
          {status === 'error' ? (
            <span className="text-rose-300">
              {(error as Error)?.message ?? 'Errore sconosciuto'}
            </span>
          ) : data ? (
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <span className="text-slate-400">In attesa di risposta…</span>
          )}
        </div>
      </section>

      <nav className="mt-8 text-center">
        <Link
          to="/research-system"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Vai a Research System →
        </Link>
      </nav>
    </div>
  );
}
