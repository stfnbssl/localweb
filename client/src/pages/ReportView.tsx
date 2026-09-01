import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  listReports,
  reportUrl,
  type ReportSummary,
} from '../services/reportsService';

export default function ReportView() {
  const { channelId = '' } = useParams();
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listReports()
      .then((all) => {
        if (!alive) return;
        const found = all.find((r) => r.channelId === channelId);
        if (found) setReport(found);
        else setError(`Nessun report per il canale ${channelId}.`);
      })
      .catch((err: Error) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [channelId]);

  const src = report ? reportUrl(report) : null;

  return (
    // 4rem è l'altezza della barra di navigazione, 2.75rem quella della riga qui
    // sotto: l'iframe si prende esattamente il resto della finestra.
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex h-11 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6 text-sm">
        <Link to="/reports" className="text-neutral-600 hover:text-neutral-900">
          ← Reports
        </Link>
        <span className="truncate font-medium text-neutral-900">
          {report?.title ?? channelId}
        </span>
        {src && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="ml-auto shrink-0 text-neutral-500 hover:text-neutral-900"
          >
            Apri in una scheda ↗
          </a>
        )}
      </div>

      {error && (
        <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {src && (
        // La pagina incorniciata ha un suo routing via hash, indipendente da
        // react-router: i due non si pestano i piedi perché vivono in due
        // documenti distinti. Il tasto indietro del browser ripercorre però
        // anche la navigazione avvenuta dentro l'iframe, prima di uscirne.
        <iframe
          key={src}
          src={src}
          title={report?.title ?? 'Report'}
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      )}
    </div>
  );
}
