import { useQuery } from '@tanstack/react-query';
import { ping, type PingResponse } from '../services/pingService';

export type ServerStatus = 'loading' | 'ok' | 'error';

export function usePing() {
  const query = useQuery<PingResponse>({
    queryKey: ['ping'],
    queryFn: ping,
  });

  const status: ServerStatus =
    query.status === 'pending' || query.isFetching
      ? 'loading'
      : query.status === 'error'
        ? 'error'
        : 'ok';

  return { ...query, status };
}
