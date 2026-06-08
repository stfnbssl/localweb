import { randomUUID } from 'crypto';
import type { SearchResult, SearchSource, SearchParams } from '../models';

export interface RawResult {
  title: string;
  authors?: string[];
  year?: number | null;
  doi?: string | null;
  url?: string | null;
  abstract?: string | null;
}

export abstract class SearchEngine {
  abstract readonly source: SearchSource;

  // Esegue la ricerca e restituisce risultati grezzi (senza id/queryId).
  abstract search(query: string, params: SearchParams): Promise<RawResult[]>;

  // Normalizza un risultato grezzo in SearchResult completo.
  toResult(queryId: string, raw: RawResult): SearchResult {
    return {
      id: randomUUID(),
      queryId,
      source: this.source,
      title: raw.title,
      authors: raw.authors ?? [],
      year: raw.year ?? null,
      doi: raw.doi ?? null,
      url: raw.url ?? null,
      abstract: raw.abstract ?? null,
      fetchedAt: new Date().toISOString(),
    };
  }
}
