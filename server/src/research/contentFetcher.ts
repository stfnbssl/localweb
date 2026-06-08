import { runCoworkJob } from './coworkRunner';

// Recupera il contenuto principale di un URL in Markdown via job Cowork (WebFetch).
export async function fetchContentAsMarkdown(
  url: string,
  title?: string
): Promise<string> {
  const input = [
    '## URL',
    url,
    '',
    '## Titolo',
    title || '(non fornito)',
    '',
    'Recupera il contenuto principale e rispondi solo con il JSON richiesto dalle istruzioni del progetto (CLAUDE.md).',
  ].join('\n');

  const raw = await runCoworkJob({
    jobName: 'fetch-content',
    input,
    timeoutMs: Number(process.env.COWORK_FETCH_TIMEOUT_MS) || 240_000,
  });

  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const parsed = JSON.parse(cleaned);
  if (typeof parsed?.markdown !== 'string') {
    throw new Error('Output privo del campo "markdown"');
  }
  return parsed.markdown;
}
