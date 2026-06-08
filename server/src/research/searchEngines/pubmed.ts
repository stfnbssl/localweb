import { SearchEngine, type RawResult } from './base';
import type { SearchSource, SearchParams } from '../models';
import { fetchWithRetry } from '../retry';

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export class PubMedSearch extends SearchEngine {
  readonly source: SearchSource = 'pubmed';

  async search(query: string, params: SearchParams): Promise<RawResult[]> {
    const retmax = params.maxResults ?? 20;
    const apiKey = process.env.PUBMED_API_KEY;
    const keyParam = apiKey ? `&api_key=${apiKey}` : '';

    // 1) esearch → lista di PMID
    const searchUrl = `${EUTILS}/esearch.fcgi?${new URLSearchParams({
      db: 'pubmed',
      term: query,
      retmax: String(retmax),
      retmode: 'json',
    })}${keyParam}`;
    const searchRes = await fetchWithRetry(searchUrl);
    if (!searchRes.ok) throw new Error(`PubMed esearch HTTP ${searchRes.status}`);
    const searchData: any = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    // 2) esummary → metadati
    const summaryUrl = `${EUTILS}/esummary.fcgi?${new URLSearchParams({
      db: 'pubmed',
      id: ids.join(','),
      retmode: 'json',
    })}${keyParam}`;
    const summaryRes = await fetchWithRetry(summaryUrl);
    if (!summaryRes.ok)
      throw new Error(`PubMed esummary HTTP ${summaryRes.status}`);
    const summaryData: any = await summaryRes.json();
    const result = summaryData?.result ?? {};

    return ids
      .map((id) => result[id])
      .filter(Boolean)
      .map((doc: any) => {
        const pubDate: string = doc.sortpubdate || doc.pubdate || '';
        const year = pubDate ? Number(pubDate.slice(0, 4)) : null;
        const doiEntry = (doc.articleids ?? []).find(
          (a: any) => a.idtype === 'doi'
        );
        return {
          title: doc.title ?? '(senza titolo)',
          authors: (doc.authors ?? []).map((a: any) => a.name).filter(Boolean),
          year: Number.isFinite(year) ? year : null,
          doi: doiEntry?.value ?? null,
          url: `https://pubmed.ncbi.nlm.nih.gov/${doc.uid}/`,
          abstract: null,
        } satisfies RawResult;
      });
  }
}
