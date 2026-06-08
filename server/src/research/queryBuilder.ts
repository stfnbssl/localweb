import type { Category } from './models';

// Sceglie il testo dell'etichetta nella lingua richiesta; se assente, ripiega
// sulla prima etichetta disponibile.
function pickLabel(category: Category, lang: string): string | null {
  const match = category.labels.find((l) => l.lang === lang);
  return (match ?? category.labels[0])?.text ?? null;
}

/**
 * Costruisce la query string a partire dai gruppi AND.
 * @param groups elenco ordinato di gruppi; ogni gruppo è l'insieme di categorie
 *               assegnate a uno stesso AND-n.
 * - categorie dello stesso gruppo → OR
 * - gruppi diversi → AND
 * Es: ("developmental screening" OR "early detection") AND ("hospital")
 */
export function buildQueryString(groups: Category[][], lang: string): string {
  const andParts: string[] = [];
  for (const group of groups) {
    const quoted = group
      .map((c) => pickLabel(c, lang))
      .filter((t): t is string => !!t)
      .map((t) => `"${t}"`);
    const unique = Array.from(new Set(quoted));
    if (unique.length === 0) continue;
    andParts.push(unique.length > 1 ? `(${unique.join(' OR ')})` : unique[0]);
  }
  return andParts.join(' AND ');
}
