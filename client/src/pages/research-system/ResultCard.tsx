import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  fetchContent,
  saveNote,
  downloadDocument,
  type SearchResult,
} from '../../services/researchService';

const SOURCE_LABEL: Record<string, string> = {
  zenodo: 'Zenodo',
  semantic_scholar: 'Semantic Scholar',
  pubmed: 'PubMed',
  web: 'Web',
};

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

export default function ResultCard({
  result,
  selected,
  onToggle,
}: {
  result: SearchResult;
  selected: boolean;
  onToggle: () => void;
}) {
  const [showContent, setShowContent] = useState(false);
  const [copied, setCopied] = useState(false);

  const contentMutation = useMutation({
    mutationFn: () => fetchContent(result.url ?? '', result.title),
  });
  const saveMutation = useMutation({
    mutationFn: (markdown: string) => saveNote(result.title, markdown),
  });
  const downloadMutation = useMutation({
    mutationFn: () => downloadDocument(result.url ?? '', result.title),
  });

  function openContent() {
    setShowContent((v) => !v);
    if (!contentMutation.data && !contentMutation.isPending) {
      contentMutation.mutate();
    }
  }

  async function copyMarkdown() {
    const md = contentMutation.data?.markdown;
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard non disponibile */
    }
  }

  return (
    <li
      className={`rounded-xl border p-3 shadow-sm ${
        selected ? 'border-primary-300 bg-primary-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-neutral-900">
              {result.url ? (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary-700 hover:underline"
                >
                  {result.title}
                </a>
              ) : (
                result.title
              )}
            </p>
            {result.year && (
              <span className="shrink-0 text-xs text-neutral-400">{result.year}</span>
            )}
          </div>
          {result.authors.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              {result.authors.slice(0, 5).join(', ')}
              {result.authors.length > 5 ? ' et al.' : ''}
            </p>
          )}
          {result.doi && (
            <p className="mt-1 font-mono text-[11px] text-neutral-400">
              doi:{result.doi}
            </p>
          )}

          {/* Azioni */}
          {result.url && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openContent}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-slate-50"
              >
                {showContent ? 'Nascondi contenuto' : 'Contenuto'}
              </button>
              <button
                type="button"
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {downloadMutation.isPending ? 'Scarico…' : 'Scarica originale'}
              </button>
              {downloadMutation.isSuccess && (
                <span className="text-[11px] text-emerald-700">
                  salvato in {downloadMutation.data.relativePath} (
                  {Math.round(downloadMutation.data.bytes / 1024)} KB)
                </span>
              )}
              {downloadMutation.isError && (
                <span className="text-[11px] text-rose-600">
                  {(downloadMutation.error as Error).message}
                </span>
              )}
            </div>
          )}

          {/* Viewer contenuto */}
          {showContent && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Contenuto · {SOURCE_LABEL[result.source] ?? result.source}
                </span>
                {contentMutation.data && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyMarkdown}
                      title="Copia il Markdown"
                      className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-neutral-700 transition hover:bg-slate-50"
                    >
                      <CopyIcon />
                      {copied ? 'Copiato!' : 'Copia'}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveMutation.mutate(contentMutation.data!.markdown)}
                      disabled={saveMutation.isPending}
                      className="rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saveMutation.isPending ? 'Salvo…' : 'Salva .md'}
                    </button>
                  </div>
                )}
              </div>

              {contentMutation.isPending && (
                <p className="mt-2 text-xs text-neutral-500">
                  Recupero contenuto via Cowork…
                </p>
              )}
              {contentMutation.isError && (
                <p className="mt-2 text-xs text-rose-600">
                  {(contentMutation.error as Error).message}
                </p>
              )}
              {saveMutation.isSuccess && (
                <p className="mt-2 text-xs text-emerald-700">
                  Salvato in {saveMutation.data.relativePath}
                </p>
              )}
              {contentMutation.data && (
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 font-mono text-xs leading-relaxed text-neutral-800">
                  {contentMutation.data.markdown || '(nessun contenuto recuperato)'}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
