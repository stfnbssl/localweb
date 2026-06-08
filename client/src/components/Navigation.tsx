import { Link, useLocation } from 'react-router-dom';
import { usePing } from '../hooks/usePing';
import StatusDot from './StatusDot';
import { APP_NAME } from '../utils/constants';

const SECTIONS = [
  { to: '/', label: 'Home', match: (p: string) => p === '/' },
  {
    to: '/research-system',
    label: 'Research System',
    match: (p: string) => p.startsWith('/research-system'),
  },
];

export default function Navigation() {
  const location = useLocation();
  const { status } = usePing();

  const statusTitle =
    status === 'ok'
      ? 'Server connesso'
      : status === 'error'
        ? 'Server non raggiungibile'
        : 'Verifica connessione…';

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="group flex flex-col items-start leading-none">
          <span className="text-lg font-semibold tracking-tight text-neutral-900">
            {APP_NAME}
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-neutral-400 transition-colors group-hover:text-neutral-600">
            ambiente locale
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          {SECTIONS.map((s) => {
            const active = s.match(location.pathname);
            return (
              <Link
                key={s.to}
                to={s.to}
                className={`transition-colors hover:text-neutral-900 ${
                  active ? 'font-medium text-neutral-900' : 'text-neutral-600'
                }`}
              >
                {s.label}
              </Link>
            );
          })}
          <span
            className="flex items-center gap-2 text-xs text-neutral-500"
            title={statusTitle}
          >
            <StatusDot status={status} />
            <span className="hidden sm:inline">{statusTitle}</span>
          </span>
        </nav>
      </div>
    </header>
  );
}
