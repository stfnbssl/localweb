import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listQueries,
  getResults,
  launchSearch,
  listSearchTypes,
  exportNotes,
  type SearchResult,
} from '../../services/researchService';
import { RESEARCH_SYSTEM_BASE } from '../../components/research-system/navItems';
import ResultCard from './ResultCard';

const SOURCE_LABEL: Record<string, string> = {
  zenodo: 'Zenodo',
  semantic_scholar: 'Semantic Scholar',
  pubmed: 'PubMed',
  web: 'Web',
};

function groupBySource(results: SearchResult[]) {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = map.get(r.source) ?? [];
    list.push(r);
    map.set(r.source, list);
  }
  return Array.from(map.entries());
}

export default function Risultati() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [maxResults, setMaxResults] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [noteTitle, setNoteTitle] = useState('');

  const queriesQuery = useQuery({
    queryKey: ['research', 'queries'],
    queryFn: () => listQueries(),
  });

  const searchTypesQuery = useQuery({
    queryKey: ['research', 'search-types'],
    queryFn: listSearchTypes,
  });

  const queryId = searchParams.get('query') ?? queriesQuery.data?.[0]?.id ?? '';
  const selectedQuery = queriesQuery.data?.find((q) => q.id === queryId);
  const activeType = searchTypesQuery.data?.find(
    (t) => t.id === selectedQuery?.searchType
  );

  const resultsQuery = useQuery({
    queryKey: ['research', 'results', queryId],
    queryFn: () => getResults(queryId),
    enabled: !!queryId,
  });

  const searchMutation = useMutation({
    mutationFn: () => launchSearch(queryId, { maxResults }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'results', queryId],
      });
    },
  });

  const grouped = useMemo(
    () => groupBySource(resultsQuery.data ?? []),
    [resultsQuery.data]
  );

  const results = resultsQuery.data ?? [];

  const exportMutation = useMutation({
    mutationFn: () =>
      exportNotes(queryId, Array.from(selectedIds), noteTitle.trim() || undefined),
  });

  // Azzera la selezione quando cambia query.
  useEffect(() => {
    setSelectedIds(new Set());
    exportMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId]);

  function toggleResult(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === results.length
        ? new Set()
        : new Set(results.map((r) => r.id))
    );
  }

  const noQueries = !queriesQuery.isPending && (queriesQuery.data?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        Ricerca e risultati
      </h1>
      <p className="mt-4 text-neutral-600">
        Lancia la query sui motori accademici. I risultati vengono salvati in
        locale (JSONL).
      </p>

      {noQueries ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Nessuna query disponibile.{' '}
            <Link
              to={`${RESEARCH_SYSTEM_BASE}/query`}
              className="font-medium text-amber-900 underline"
            >
              Costruisci prima una query →
            </Link>
          </p>
        </div>
      ) : (
        <>
          {/* Selettore query */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700">
              Query
            </label>
            <select
              value={queryId}
              onChange={(e) =>
                setSearchParams({ query: e.target.value }, { replace: true })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {queriesQuery.data?.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.lang}] {q.queryString.slice(0, 70)}
                  {q.queryString.length > 70 ? '…' : ''}
                </option>
              ))}
            </select>

            {selectedQuery && (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
                {selectedQuery.queryString}
              </pre>
            )}

            {/* Tipo di ricerca (determina i motori) + maxResults */}
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-700">
                  Tipo di ricerca
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {activeType ? (
                    <>
                      <span className="font-medium">{activeType.label}</span>{' '}
                      <span className="text-neutral-400">
                        · motori: {activeType.engines.join(', ')}
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400">
                      {selectedQuery?.searchType ?? '—'}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Max risultati / motore
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <button
                type="button"
                onClick={() => searchMutation.mutate()}
                disabled={!queryId || searchMutation.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchMutation.isPending ? 'Ricerca…' : 'Lancia ricerca'}
              </button>
            </div>
          </div>

          {searchMutation.isPending && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-neutral-600">
              Interrogazione dei motori in corso…
            </p>
          )}
          {searchMutation.isError && (
            <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              {(searchMutation.error as Error).message}
            </p>
          )}
          {searchMutation.isSuccess && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              <span className="font-semibold">
                {searchMutation.data.total} nuovi risultati
                {searchMutation.data.duplicates > 0 &&
                  ` (${searchMutation.data.duplicates} già presenti, scartati)`}
                .
              </span>{' '}
              {Object.entries(searchMutation.data.perSource).map(([s, v]) => (
                <span key={s} className="mr-3">
                  {SOURCE_LABEL[s] ?? s}: {String(v)}
                </span>
              ))}
            </div>
          )}

          {/* Risultati */}
          <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Risultati salvati ({results.length})
          </h2>

          {/* Barra di export Markdown */}
          {results.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {selectedIds.size === results.length
                    ? 'Deseleziona tutti'
                    : 'Seleziona tutti'}
                </button>
                <span className="text-sm text-neutral-500">
                  {selectedIds.size} selezionati
                </span>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="titolo nota (opzionale)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => exportMutation.mutate()}
                  disabled={selectedIds.size === 0 || exportMutation.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportMutation.isPending
                    ? 'Salvataggio…'
                    : 'Salva selezionati (Markdown)'}
                </button>
              </div>
              {exportMutation.isError && (
                <p className="mt-2 text-xs text-rose-700">
                  {(exportMutation.error as Error).message}
                </p>
              )}
              {exportMutation.isSuccess && (
                <p className="mt-2 text-xs text-emerald-700">
                  Salvati {exportMutation.data.count} risultati in{' '}
                  <code className="rounded bg-emerald-50 px-1 py-0.5">
                    {exportMutation.data.relativePath}
                  </code>
                </p>
              )}
            </div>
          )}

          <div className="mt-4 space-y-6">
            {resultsQuery.isPending && (
              <p className="text-sm text-neutral-400">Caricamento…</p>
            )}
            {resultsQuery.data?.length === 0 && !resultsQuery.isPending && (
              <p className="text-sm text-neutral-400">
                Nessun risultato ancora. Lancia la ricerca.
              </p>
            )}
            {grouped.map(([source, items]) => (
              <div key={source}>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  {SOURCE_LABEL[source] ?? source} ({items.length})
                </p>
                <ul className="mt-2 space-y-2">
                  {items.map((r) => (
                    <ResultCard
                      key={r.id}
                      result={r}
                      selected={selectedIds.has(r.id)}
                      onToggle={() => toggleResult(r.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
