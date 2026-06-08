import { apiRequest } from './apiClient';

export interface PingResponse {
  pong: boolean;
  message: string;
  server: string;
  timestamp: string;
}

export function ping(): Promise<PingResponse> {
  return apiRequest<PingResponse>('/ping');
}
