import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/youtube', label: 'Video singolo', exact: true },
  { to: '/youtube/canale', label: 'Canale', exact: false },
];

export default function YoutubeTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="mb-8 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`rounded-md px-3 py-1.5 transition ${
              active
                ? 'bg-white font-medium text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
