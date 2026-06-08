import { Link, useLocation } from 'react-router-dom';
import {
  RESEARCH_SYSTEM_BASE,
  RESEARCH_SYSTEM_SECTIONS,
} from './navItems';

export default function ResearchSystemNav() {
  const location = useLocation();
  const onRoot = location.pathname === RESEARCH_SYSTEM_BASE;

  const linkClass = (active: boolean) =>
    `flex-shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs transition-colors ${
      active
        ? 'bg-primary-50 font-medium text-primary-700'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="sticky top-16 z-40 border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6">
        <nav
          className="flex items-center gap-1 overflow-x-auto py-1.5"
          style={{ scrollbarWidth: 'none' }}
        >
          <Link to={RESEARCH_SYSTEM_BASE} className={linkClass(onRoot)}>
            Panoramica
          </Link>
          <span className="mx-1 self-center text-slate-300">|</span>
          {RESEARCH_SYSTEM_SECTIONS.map((s) => {
            const to = `${RESEARCH_SYSTEM_BASE}/${s.slug}`;
            return (
              <Link
                key={s.slug}
                to={to}
                className={linkClass(location.pathname.startsWith(to))}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
