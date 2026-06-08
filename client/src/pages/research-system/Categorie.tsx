import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listThemes,
  listCategories,
  extractCategories,
  type Category,
} from '../../services/researchService';
import { RESEARCH_SYSTEM_BASE } from '../../components/research-system/navItems';

function groupByDimension(categories: Category[]) {
  const map = new Map<string, Category[]>();
  for (const c of categories) {
    const list = map.get(c.dimension) ?? [];
    list.push(c);
    map.set(c.dimension, list);
  }
  return Array.from(map.entries());
}

export default function Categorie() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const themesQuery = useQuery({
    queryKey: ['research', 'themes'],
    queryFn: listThemes,
  });

  // Tema selezionato: da ?theme=, altrimenti il primo disponibile.
  const themeId = searchParams.get('theme') ?? themesQuery.data?.[0]?.id ?? '';
  const selectedTheme = themesQuery.data?.find((t) => t.id === themeId);

  const categoriesQuery = useQuery({
    queryKey: ['research', 'categories', themeId],
    queryFn: () => listCategories(themeId),
    enabled: !!themeId,
  });

  const extractMutation = useMutation({
    mutationFn: () => extractCategories(themeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['research', 'categories', themeId],
      });
    },
  });

  const grouped = useMemo(
    () => groupByDimension(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  );

  const noThemes = themesQuery.data?.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        Estrazione categorie
      </h1>
      <p className="mt-4 text-neutral-600">
        Claude (via Cowork) estrae dal tema le categorie di ricerca, raggruppate
        per dimensione. Le nuove categorie non duplicano quelle già presenti.
      </p>

      {noThemes ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Nessun tema disponibile.{' '}
            <Link
              to={`${RESEARCH_SYSTEM_BASE}/temi`}
              className="font-medium text-amber-900 underline"
            >
              Crea prima un tema →
            </Link>
          </p>
        </div>
      ) : (
        <>
          {/* Selettore tema + azione */}
          <div className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700">
                Tema
              </label>
              <select
                value={themeId}
                onChange={(e) =>
                  setSearchParams({ theme: e.target.value }, { replace: true })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {themesQuery.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => extractMutation.mutate()}
              disabled={!themeId || extractMutation.isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {extractMutation.isPending ? 'Estrazione…' : 'Estrai categorie'}
            </button>
          </div>

          {selectedTheme && (
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              {selectedTheme.rawText}
            </p>
          )}

          {extractMutation.isPending && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-neutral-600">
              Spawn di Cowork in corso — può richiedere alcuni secondi.
            </p>
          )}
          {extractMutation.isError && (
            <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              {(extractMutation.error as Error).message}
            </p>
          )}
          {extractMutation.isSuccess && (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
              Aggiunte {extractMutation.data.length} nuove categorie.
            </p>
          )}

          {/* Categorie raggruppate */}
          <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Categorie del tema
          </h2>
          <div className="mt-4 space-y-5">
            {categoriesQuery.isPending && (
              <p className="text-sm text-neutral-400">Caricamento…</p>
            )}
            {categoriesQuery.data?.length === 0 &&
              !categoriesQuery.isPending && (
                <p className="text-sm text-neutral-400">
                  Nessuna categoria ancora. Usa “Estrai categorie”.
                </p>
              )}
            {grouped.map(([dimension, cats]) => (
              <div key={dimension}>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  {dimension}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cats.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      {c.labels.map((l) => (
                        <span
                          key={l.lang}
                          className="flex items-center gap-1.5 text-sm text-neutral-700"
                        >
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                            {l.lang}
                          </span>
                          {l.text}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {(categoriesQuery.data?.length ?? 0) > 0 && (
            <div className="mt-10">
              <Link
                to={`${RESEARCH_SYSTEM_BASE}/query?theme=${themeId}`}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Prosegui: costruisci una query →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
