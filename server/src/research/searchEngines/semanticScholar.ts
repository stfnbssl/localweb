import { SearchEngine, type RawResult } from './base';
import type { SearchSource, SearchParams } from '../models';
import { fetchWithRetry } from '../retry';

export class SemanticScholarSearch extends SearchEngine {
  readonly source: SearchSource = 'semantic_scholar';

  async search(query: string, params: SearchParams): Promise<RawResult[]> {
    const limit = params.maxResults ?? 20;
    const fields = 'title,authors,year,externalIds,abstract,url';
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?${new URLSearchParams(
      { query, limit: String(limit), fields }
    )}`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    if (apiKey) headers['x-api-key'] = apiKey;

    const res = await fetchWithRetry(url, { headers });
    if (!res.ok) throw new Error(`Semantic Scholar HTTP ${res.status}`);
    const data: any = await res.json();
    const papers: any[] = data?.data ?? [];

    return papers.map(
      (p) =>
        ({
          title: p.title ?? '(senza titolo)',
          authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
          year: typeof p.year === 'number' ? p.year : null,
          doi: p.externalIds?.DOI ?? null,
          url: p.url ?? null,
          abstract: p.abstract ?? null,
        }) satisfies RawResult
    );
  }
}
