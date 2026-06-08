import type { Theme, Category, LocalizedLabel } from './models';
import { runCoworkJob } from './coworkRunner';

export interface ExtractedCategory {
  dimension: string;
  labels: LocalizedLabel[];
}

// Compone l'input su stdin: il tema + le categorie già esistenti (come JSONL,
// riferimento per non duplicarle — con tutte le lingue).
function buildInput(theme: Theme, existing: Category[]): string {
  const existingJsonl = existing
    .map((c) => JSON.stringify({ dimension: c.dimension, labels: c.labels }))
    .join('\n');

  return [
    '## Tema',
    `Titolo: ${theme.title}`,
    `Descrizione: ${theme.rawText}`,
    '',
    '## Categorie già esistenti (JSONL, riferimento — non riproporle)',
    existingJsonl || '(nessuna)',
    '',
    'Estrai le NUOVE categorie dal tema seguendo le istruzioni del progetto (CLAUDE.md) e rispondi solo con il JSON richiesto.',
  ].join('\n');
}

function parseLabels(raw: any): LocalizedLabel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l: any) => l && typeof l.text === 'string' && typeof l.lang === 'string'
    )
    .map((l: any) => ({ text: l.text.trim(), lang: l.lang.trim().toLowerCase() }))
    .filter((l: LocalizedLabel) => l.text && l.lang);
}

function parseResult(text: string): ExtractedCategory[] {
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const parsed = JSON.parse(cleaned);
  const arr = Array.isArray(parsed) ? parsed : parsed?.categories;
  if (!Array.isArray(arr)) {
    throw new Error('Output privo di un array "categories" valido');
  }
  return arr
    .filter((c: any) => c && typeof c.dimension === 'string')
    .map((c: any) => ({
      dimension: c.dimension.trim(),
      labels: parseLabels(c.labels),
    }))
    .filter((c: ExtractedCategory) => c.dimension && c.labels.length > 0);
}

export async function extractCategoriesViaCowork(
  theme: Theme,
  existing: Category[]
): Promise<ExtractedCategory[]> {
  const input = buildInput(theme, existing);
  const result = await runCoworkJob({
    jobName: 'extract-categories',
    input,
    timeoutMs: Number(process.env.COWORK_TIMEOUT_MS) || 120_000,
  });
  return parseResult(result);
}
