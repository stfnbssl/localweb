import type { ServerStatus } from '../hooks/usePing';

export default function StatusDot({ status }: { status: ServerStatus }) {
  const color =
    status === 'ok'
      ? 'bg-emerald-500'
      : status === 'error'
        ? 'bg-rose-500'
        : 'bg-amber-400';
  return (
    <span className="relative flex h-3 w-3">
      {status === 'loading' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${color}`} />
    </span>
  );
}
