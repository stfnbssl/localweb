import { SearchEngine, type RawResult } from './base';
import type { SearchSource, SearchParams } from '../models';
import { runCoworkJob } from '../coworkRunner';

// Motore web basato su Cowork: spawna il job `web-search` che usa la web search
// integrata di Claude. Lo "scope" (es. solo siti ufficiali) arriva da SearchParams.
export class WebSearch extends SearchEngine {
  readonly source: SearchSource = 'web';

  async search(query: string, params: SearchParams): Promise<RawResult[]> {
    const max = params.maxResults ?? 10;
    const input = [
      `## Query`,
      query,
      '',
      `## Lingua`,
      params.lang || 'it',
      '',
      `## Scope`,
      params.scopeHint || '(nessuna restrizione)',
      '',
      `## Max risultati`,
      String(max),
      '',
      'Esegui la ricerca web e rispondi solo con il JSON richiesto dalle istruzioni del progetto (CLAUDE.md).',
    ].join('\n');

    const raw = await runCoworkJob({
      jobName: 'web-search',
      input,
      timeoutMs: Number(process.env.COWORK_WEB_TIMEOUT_MS) || 180_000,
    });

    return parseResults(raw, max);
  }
}

function parseResults(text: string, max: number): RawResult[] {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const parsed = JSON.parse(cleaned);
  const arr = Array.isArray(parsed) ? parsed : parsed?.results;
  if (!Array.isArray(arr)) {
    throw new Error('Output privo di un array "results" valido');
  }

  return arr
    .filter((r: any) => r && typeof r.title === 'string' && typeof r.url === 'string')
    .slice(0, max)
    .map((r: any) => {
      const year = typeof r.year === 'number' ? r.year : null;
      const site = typeof r.site === 'string' && r.site.trim() ? r.site.trim() : null;
      return {
        title: r.title.trim(),
        authors: site ? [site] : [],
        year,
        doi: null,
        url: r.url.trim(),
        abstract: typeof r.snippet === 'string' ? r.snippet.trim() : null,
      } satisfies RawResult;
    });
}
