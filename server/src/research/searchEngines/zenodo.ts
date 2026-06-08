import { SearchEngine, type RawResult } from './base';
import type { SearchSource, SearchParams } from '../models';
import { fetchWithRetry } from '../retry';

export class ZenodoSearch extends SearchEngine {
  readonly source: SearchSource = 'zenodo';

  async search(query: string, params: SearchParams): Promise<RawResult[]> {
    const size = params.maxResults ?? 20;
    const url = `https://zenodo.org/api/records?${new URLSearchParams({
      q: query,
      size: String(size),
      sort: 'bestmatch',
    })}`;

    const res = await fetchWithRetry(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Zenodo HTTP ${res.status}`);
    const data: any = await res.json();
    const hits: any[] = data?.hits?.hits ?? [];

    return hits.map((h) => {
      const md = h.metadata ?? {};
      const pubDate: string | undefined = md.publication_date;
      const year = pubDate ? Number(pubDate.slice(0, 4)) : null;
      return {
        title: md.title ?? '(senza titolo)',
        authors: (md.creators ?? []).map((c: any) => c.name).filter(Boolean),
        year: Number.isFinite(year) ? year : null,
        doi: h.doi ?? md.doi ?? null,
        url: h.links?.self_html ?? h.links?.html ?? null,
        abstract: md.description ?? null,
      } satisfies RawResult;
    });
  }
}
