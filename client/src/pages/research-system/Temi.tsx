import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTheme, listThemes } from '../../services/researchService';
import { RESEARCH_SYSTEM_BASE } from '../../components/research-system/navItems';

export default function Temi() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');

  const themesQuery = useQuery({
    queryKey: ['research', 'themes'],
    queryFn: listThemes,
  });

  const createMutation = useMutation({
    mutationFn: () => createTheme(title.trim(), rawText.trim()),
    onSuccess: () => {
      setTitle('');
      setRawText('');
      queryClient.invalidateQueries({ queryKey: ['research', 'themes'] });
    },
  });

  const canSubmit =
    title.trim().length > 0 && rawText.trim().length > 0 && !createMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        Temi di ricerca
      </h1>
      <p className="mt-4 text-neutral-600">
        Punto di partenza del flusso: descrivi un interesse di ricerca in
        linguaggio naturale.
      </p>

      {/* Form */}
      <form
        className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) createMutation.mutate();
        }}
      >
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Titolo
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Es. Screening sviluppo 0-3 in ospedale"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Descrizione
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={3}
            placeholder="Descrivi l'interesse di ricerca…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creazione…' : 'Crea tema'}
          </button>
          {createMutation.isError && (
            <span className="text-sm text-rose-600">
              {(createMutation.error as Error).message}
            </span>
          )}
        </div>
      </form>

      {/* Lista */}
      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Temi salvati
      </h2>
      <div className="mt-4 space-y-3">
        {themesQuery.isPending && (
          <p className="text-sm text-neutral-400">Caricamento…</p>
        )}
        {themesQuery.isError && (
          <p className="text-sm text-rose-600">
            {(themesQuery.error as Error).message}
          </p>
        )}
        {themesQuery.data?.length === 0 && (
          <p className="text-sm text-neutral-400">Nessun tema ancora.</p>
        )}
        {themesQuery.data?.map((theme) => (
          <div
            key={theme.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-neutral-900">{theme.title}</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {theme.status}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              {theme.rawText}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-neutral-400">
                {theme.id}
              </span>
              <Link
                to={`${RESEARCH_SYSTEM_BASE}/categorie?theme=${theme.id}`}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Categorie →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
