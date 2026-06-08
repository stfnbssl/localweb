import { Link } from 'react-router-dom';
import {
  RESEARCH_SYSTEM_BASE,
  RESEARCH_SYSTEM_SECTIONS,
} from '../../components/research-system/navItems';

const FLOW = [
  { n: 1, label: 'Tema', desc: 'interesse in linguaggio naturale' },
  { n: 2, label: 'Categorie', desc: 'estratte da Claude' },
  { n: 3, label: 'Query', desc: 'combinazione delle categorie' },
  { n: 4, label: 'Ricerca', desc: 'motori accademici' },
  { n: 5, label: 'Risultati', desc: 'salvati in JSONL' },
];

const ENGINES = ['Zenodo', 'Semantic Scholar', 'PubMed'];

export default function ResearchSystemHome() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
        sezione
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
        Research System
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-600">
        Ricerca bibliografica assistita da Claude: da un interesse di ricerca
        in linguaggio naturale a risultati raccolti da fonti accademiche,
        archiviati in locale.
      </p>

      {/* Flusso */}
      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Il flusso
      </h2>
      <ol className="mt-4 flex flex-wrap items-stretch gap-2">
        {FLOW.map((step, i) => (
          <li key={step.n} className="flex items-stretch gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white">
                  {step.n}
                </span>
                <span className="text-sm font-medium text-neutral-900">
                  {step.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">{step.desc}</p>
            </div>
            {i < FLOW.length - 1 && (
              <span className="self-center text-slate-300">→</span>
            )}
          </li>
        ))}
      </ol>

      {/* Sezioni */}
      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Sezioni
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {RESEARCH_SYSTEM_SECTIONS.map((s) => (
          <Link
            key={s.slug}
            to={`${RESEARCH_SYSTEM_BASE}/${s.slug}`}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:shadow"
          >
            <p className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
              {s.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              {s.summary}
            </p>
          </Link>
        ))}
      </div>

      {/* Motori */}
      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Motori di ricerca
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {ENGINES.map((e) => (
          <span
            key={e}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-neutral-700"
          >
            {e}
          </span>
        ))}
      </div>

      {/* Backend */}
      <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-neutral-900">
          Backend integrato nel server locale
        </p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          Il flusso è servito dal server Node locale sotto{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-neutral-700">
            /api/research
          </code>
          . L'estrazione delle categorie richiede una{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-neutral-700">
            ANTHROPIC_API_KEY
          </code>{' '}
          in <code className="text-neutral-700">server/.env</code>.
        </p>
        <Link
          to={`${RESEARCH_SYSTEM_BASE}/temi`}
          className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          Inizia da un tema →
        </Link>
      </section>
    </div>
  );
}
