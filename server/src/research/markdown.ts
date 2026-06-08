import type { SearchResult } from './models';

const SOURCE_LABEL: Record<string, string> = {
  zenodo: 'Zenodo',
  semantic_scholar: 'Semantic Scholar',
  pubmed: 'PubMed',
  web: 'Web',
};

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // rimuove accenti
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'note'
  );
}

// Timestamp compatto YYYYMMDD-HHmmss (ora locale).
export function timestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export function buildResultsMarkdown(opts: {
  title: string;
  queryString: string;
  searchType: string;
  results: SearchResult[];
  exportedAt: Date;
}): string {
  const { title, queryString, searchType, results, exportedAt } = opts;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(
    `> Esportato il ${exportedAt.toLocaleString('it-IT')} · tipo: ${searchType} · ${results.length} risultati`
  );
  lines.push('>');
  lines.push(`> Query: \`${queryString}\``);
  lines.push('');

  for (const r of results) {
    lines.push(`## ${r.title}`);
    const meta: string[] = [`**Fonte:** ${SOURCE_LABEL[r.source] ?? r.source}`];
    if (r.authors.length) meta.push(`**Autori:** ${r.authors.join(', ')}`);
    if (r.year) meta.push(`**Anno:** ${r.year}`);
    if (r.doi) meta.push(`**DOI:** ${r.doi}`);
    lines.push(meta.join(' · '));
    if (r.url) lines.push('', `<${r.url}>`);
    if (r.abstract) lines.push('', r.abstract);
    lines.push('', '---', '');
  }

  return lines.join('\n');
}
