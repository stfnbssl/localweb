import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listThemes,
  listAllCategories,
  listQueries,
  createQuery,
  updateQuery,
  listSearchTypes,
  type Category,
  type Query,
  type QueryInput,
} from '../../services/researchService';
import { RESEARCH_SYSTEM_BASE } from '../../components/research-system/navItems';

const LANG_NAMES: Record<string, string> = { en: 'Inglese', it: 'Italiano' };
const GROUPS = [1, 2, 3, 4, 5];
const GROUP_STYLE: Record<number, string> = {
  1: 'border-sky-500 bg-sky-500 text-white',
  2: 'border-violet-500 bg-violet-500 text-white',
  3: 'border-amber-500 bg-amber-500 text-white',
  4: 'border-emerald-500 bg-emerald-500 text-white',
  5: 'border-rose-500 bg-rose-500 text-white',
};

function labelFor(category: Category, lang: string): string {
  const match = category.labels.find((l) => l.lang === lang);
  return (match ?? category.labels[0])?.text ?? '';
}

function buildPreview(
  assignments: Map<string, number>,
  byId: Map<string, Category>,
  lang: string
): string {
  const andParts: string[] = [];
  for (const g of GROUPS) {
    const texts = Array.from(assignments.entries())
      .filter(([, grp]) => grp === g)
      .map(([id]) => byId.get(id))
      .filter((c): c is Category => !!c)
      .map((c) => `"${labelFor(c, lang)}"`);
    const unique = Array.from(new Set(texts));
    if (unique.length === 0) continue;
    andParts.push(unique.length > 1 ? `(${unique.join(' OR ')})` : unique[0]);
  }
  return andParts.join(' AND ');
}

export default function QueryPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Map<string, number>>(new Map());
  const [lang, setLang] = useState('en');
  const [searchType, setSearchType] = useState('academic');

  // Filtri del pool categorie
  const [filterText, setFilterText] = useState('');
  const [filterTheme, setFilterTheme] = useState(searchParams.get('theme') ?? '');
  const [filterDimension, setFilterDimension] = useState('');

  const themesQuery = useQuery({ queryKey: ['research', 'themes'], queryFn: listThemes });
  const categoriesQuery = useQuery({
    queryKey: ['research', 'all-categories'],
    queryFn: listAllCategories,
  });
  const queriesQuery = useQuery({ queryKey: ['research', 'queries'], queryFn: listQueries });
  const searchTypesQuery = useQuery({
    queryKey: ['research', 'search-types'],
    queryFn: listSearchTypes,
  });

  const categories = categoriesQuery.data ?? [];
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const themeTitle = useMemo(() => {
    const m = new Map<string, string>();
    (themesQuery.data ?? []).forEach((t) => m.set(t.id, t.title));
    return m;
  }, [themesQuery.data]);

  const availableLangs = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => c.labels.forEach((l) => set.add(l.lang)));
    return Array.from(set);
  }, [categories]);
  const effectiveLang = availableLangs.includes(lang) ? lang : (availableLangs[0] ?? 'en');

  const dimensions = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add(c.dimension));
    return Array.from(set).sort();
  }, [categories]);

  const activeType = searchTypesQuery.data?.find((t) => t.id === searchType);
  const editingQuery = queriesQuery.data?.find((q) => q.id === editingId);
  const isImmutable = !!editingQuery?.executedAt;

  // Categorie filtrate
  const filtered = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return categories.filter((c) => {
      if (filterTheme && c.themeId !== filterTheme) return false;
      if (filterDimension && c.dimension !== filterDimension) return false;
      if (text && !c.labels.some((l) => l.text.toLowerCase().includes(text)))
        return false;
      return true;
    });
  }, [categories, filterText, filterTheme, filterDimension]);

  const filteredByDimension = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of filtered) {
      const list = map.get(c.dimension) ?? [];
      list.push(c);
      map.set(c.dimension, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const preview = useMemo(
    () => buildPreview(assignments, byId, effectiveLang),
    [assignments, byId, effectiveLang]
  );

  function loadQuery(q: Query) {
    setEditingId(q.id);
    setAssignments(new Map(q.selections.map((s) => [s.categoryId, s.group])));
    setLang(q.lang);
    setSearchType(q.searchType);
  }

  function newQuery() {
    setEditingId(null);
    setAssignments(new Map());
  }

  function assign(categoryId: string, group: number) {
    setAssignments((prev) => {
      const next = new Map(prev);
      if (next.get(categoryId) === group) next.delete(categoryId);
      else next.set(categoryId, group);
      return next;
    });
  }

  const saveMode: 'create' | 'create-from' | 'update' =
    editingId == null ? 'create' : isImmutable ? 'create-from' : 'update';

  const saveMutation = useMutation({
    mutationFn: async () => {
      const input: QueryInput = {
        selections: Array.from(assignments.entries()).map(([categoryId, group]) => ({
          categoryId,
          group,
        })),
        lang: effectiveLang,
        searchType,
      };
      if (saveMode === 'update' && editingId) {
        try {
          return await updateQuery(editingId, input);
        } catch {
          // 409 (eseguita nel frattempo) o altro → crea nuova
          return await createQuery(input);
        }
      }
      return await createQuery(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['research', 'queries'] });
      setEditingId(saved.id);
    },
  });

  // Se cambia ?theme nell'URL (link da Categorie), aggiorna il filtro.
  useEffect(() => {
    const t = searchParams.get('theme');
    if (t) setFilterTheme(t);
  }, [searchParams]);

  const saveLabel =
    saveMode === 'update'
      ? 'Salva modifiche'
      : saveMode === 'create-from'
        ? 'Salva come nuova query'
        : 'Crea query';

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        Costruzione query
      </h1>
      <p className="mt-4 text-neutral-600">
        Le query non sono legate a un tema: puoi pescare categorie da qualsiasi
        tema. Le query già eseguite sono immutabili; modificarle crea una nuova
        query.
      </p>

      {/* Elenco query */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Query salvate
        </h2>
        <button
          type="button"
          onClick={newQuery}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-slate-50"
        >
          + Nuova query
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {queriesQuery.data?.length === 0 && (
          <p className="text-sm text-neutral-400">Nessuna query ancora.</p>
        )}
        {queriesQuery.data?.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => loadQuery(q)}
            className={`block w-full rounded-xl border p-3 text-left transition ${
              editingId === q.id
                ? 'border-primary-400 bg-primary-50'
                : 'border-slate-200 bg-white hover:border-primary-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  q.executedAt
                    ? 'bg-slate-200 text-slate-600'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {q.executedAt ? 'eseguita · immutabile' : 'bozza · modificabile'}
              </span>
              <span className="text-[11px] uppercase text-neutral-400">
                {q.searchType} · {q.lang}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-neutral-700">
              {q.queryString}
            </p>
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {editingId ? 'Modifica query' : 'Nuova query'}
        </h2>

        {isImmutable && (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-neutral-600">
            Questa query è già stata eseguita ed è immutabile. Le modifiche
            verranno salvate come <strong>nuova query</strong>.
          </p>
        )}

        {/* Lingua + tipo ricerca */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Lingua</label>
            <select
              value={effectiveLang}
              onChange={(e) => setLang(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {(availableLangs.length ? availableLangs : ['en']).map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l] ?? l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700">
              Tipo di ricerca
            </label>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {searchTypesQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {activeType && (
              <p className="mt-1 text-xs text-neutral-500">
                {activeType.description} · motori: {activeType.engines.join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Pannello filtri categorie */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Filtra le categorie ({filtered.length}/{categories.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="cerca nel testo…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
            />
            <select
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Tutti i temi</option>
              {themesQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <select
              value={filterDimension}
              onChange={(e) => setFilterDimension(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Tutte le dimensioni</option>
              {dimensions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {(filterText || filterTheme || filterDimension) && (
              <button
                type="button"
                onClick={() => {
                  setFilterText('');
                  setFilterTheme('');
                  setFilterDimension('');
                }}
                className="rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-800"
              >
                Azzera
              </button>
            )}
          </div>
        </div>

        {/* Categorie filtrate → assegnazione AND */}
        <div className="mt-4 space-y-5">
          {categoriesQuery.isPending && (
            <p className="text-sm text-neutral-400">Caricamento categorie…</p>
          )}
          {filtered.length === 0 && !categoriesQuery.isPending && (
            <p className="text-sm text-neutral-400">
              Nessuna categoria con questi filtri.
            </p>
          )}
          {filteredByDimension.map(([dimension, cats]) => (
            <div key={dimension}>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                {dimension}
              </p>
              <div className="mt-2 space-y-1.5">
                {cats.map((c) => {
                  const current = assignments.get(c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
                    >
                      <span className="min-w-0">
                        <span className="text-sm text-neutral-700">
                          {labelFor(c, effectiveLang)}
                        </span>
                        {!filterTheme && themeTitle.get(c.themeId) && (
                          <span className="ml-2 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-400">
                            {themeTitle.get(c.themeId)}
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {GROUPS.map((g) => {
                          const active = current === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => assign(c.id, g)}
                              title={`AND-${g}`}
                              className={`h-6 w-6 rounded-md border text-xs font-semibold transition ${
                                active
                                  ? GROUP_STYLE[g]
                                  : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Anteprima + salvataggio */}
        <h3 className="mt-8 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Anteprima ({assignments.size} categorie assegnate)
        </h3>
        <pre className="mt-2 min-h-[3rem] whitespace-pre-wrap rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-100">
          {preview || '(assegna almeno una categoria a un gruppo AND)'}
        </pre>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={assignments.size === 0 || saveMutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Salvataggio…' : saveLabel}
          </button>
          {saveMutation.isError && (
            <span className="text-sm text-rose-600">
              {(saveMutation.error as Error).message}
            </span>
          )}
          {saveMutation.isSuccess && (
            <Link
              to={`${RESEARCH_SYSTEM_BASE}/risultati?query=${saveMutation.data.id}`}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Vai ai risultati →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
