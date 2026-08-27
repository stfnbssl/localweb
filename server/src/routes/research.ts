import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  JsonlStore,
  notesPath,
  documentsPath,
  writeTextFile,
  writeBinaryFile,
} from '../research/storage';
import {
  buildResultsMarkdown,
  slugify,
  timestamp,
} from '../research/markdown';
import { fetchContentAsMarkdown } from '../research/contentFetcher';
import { fetchWithRetry } from '../research/retry';
import type {
  Theme,
  Category,
  Query,
  QuerySelection,
  SearchResult,
  SearchSource,
} from '../research/models';
import { extractCategoriesViaCowork } from '../research/coworkExtractor';
import { buildQueryString } from '../research/queryBuilder';
import { SEARCH_ENGINES, ALL_SOURCES } from '../research/searchEngines';
import { SEARCH_TYPES, getSearchType, DEFAULT_SEARCH_TYPE } from '../research/searchTypes';

const router = Router();

const themes = new JsonlStore<Theme>('themes.jsonl');
const categories = new JsonlStore<Category>('categories.jsonl');
const queries = new JsonlStore<Query>('queries.jsonl');
const resultsStore = (queryId: string) =>
  new JsonlStore<SearchResult>(`results/${queryId}.jsonl`);

function now() {
  return new Date().toISOString();
}

// Chiave logica di un risultato: due record con la stessa chiave sono lo stesso
// paper, anche se hanno id diversi (l'id è generato a ogni fetch). Il DOI è
// l'identificatore forte; in sua assenza si ripiega su url e infine sul titolo
// normalizzato. La sorgente fa parte della chiave: lo stesso paper trovato da
// due motori resta due risultati distinti, con metadati potenzialmente diversi.
function resultKey(r: SearchResult): string {
  const ident =
    r.doi?.trim().toLowerCase() ||
    r.url?.trim().toLowerCase() ||
    r.title.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${r.source}::${ident}`;
}

// --- Motori disponibili ---
router.get('/engines', (_req, res) => {
  res.json({ sources: ALL_SOURCES });
});

// --- Tipi di ricerca disponibili ---
router.get('/search-types', (_req, res) => {
  res.json(Object.values(SEARCH_TYPES));
});

// --- Temi ---
router.get('/themes', async (_req, res) => {
  res.json(await themes.readAll());
});

router.post('/themes', async (req, res) => {
  const { title, rawText } = req.body ?? {};
  if (!title || !rawText) {
    return res.status(400).json({ error: 'title e rawText sono obbligatori' });
  }
  const theme: Theme = {
    id: randomUUID(),
    title: String(title),
    rawText: String(rawText),
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  };
  await themes.append(theme);
  res.status(201).json(theme);
});

router.get('/themes/:id', async (req, res) => {
  const theme = await themes.findById(req.params.id);
  if (!theme) return res.status(404).json({ error: 'Tema non trovato' });
  res.json(theme);
});

// Tutte le categorie (di ogni tema) — pool per la costruzione query.
router.get('/categories', async (_req, res) => {
  res.json(await categories.readAll());
});

router.get('/themes/:id/categories', async (req, res) => {
  const all = await categories.readAll();
  res.json(all.filter((c) => c.themeId === req.params.id));
});

// --- Estrazione categorie (spawn Cowork) ---
// Lancia il job cowork_jobs/extract-categories passando il tema + le categorie
// esistenti come riferimento; aggiorna l'archivio con le nuove categorie.
router.post('/themes/:id/extract-categories', async (req, res) => {
  const theme = await themes.findById(req.params.id);
  if (!theme) return res.status(404).json({ error: 'Tema non trovato' });

  try {
    const all = await categories.readAll();
    const existing = all.filter((c) => c.themeId === theme.id);

    const extracted = await extractCategoriesViaCowork(theme, existing);
    const records: Category[] = extracted.map((c) => ({
      id: randomUUID(),
      themeId: theme.id,
      dimension: c.dimension,
      labels: c.labels,
      createdAt: now(),
    }));
    await categories.appendMany(records);
    res.status(201).json(records);
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Estrazione fallita' });
  }
});

// --- Query ---
router.get('/queries', async (_req, res) => {
  const all = await queries.readAll();
  // più recenti prima
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(all);
});

// Normalizza/valida le selezioni e ricostruisce i campi derivati della query
// (lang, searchType, queryString) a partire dal body. Ritorna un errore (string)
// oppure i campi pronti.
async function buildQueryFields(body: any): Promise<
  | { error: string }
  | {
      selections: QuerySelection[];
      lang: string;
      searchType: string;
      queryString: string;
    }
> {
  const { selections, lang, searchType } = body ?? {};
  if (!Array.isArray(selections)) return { error: 'selections[] è obbligatorio' };

  const queryLang =
    typeof lang === 'string' && lang.trim() ? lang.trim() : 'en';
  const type = getSearchType(
    typeof searchType === 'string' ? searchType : DEFAULT_SEARCH_TYPE
  );

  const cleanSelections: QuerySelection[] = (selections as any[])
    .filter(
      (s) =>
        s &&
        typeof s.categoryId === 'string' &&
        Number.isInteger(s.group) &&
        s.group >= 1 &&
        s.group <= 5
    )
    .map((s) => ({ categoryId: s.categoryId, group: s.group }));

  if (cleanSelections.length === 0) {
    return { error: 'Nessuna categoria assegnata a un gruppo AND (1..5)' };
  }

  const all = await categories.readAll();
  const byId = new Map(all.map((c) => [c.id, c]));
  const groupedCategories: Category[][] = [];
  for (let g = 1; g <= 5; g++) {
    const cats = cleanSelections
      .filter((s) => s.group === g)
      .map((s) => byId.get(s.categoryId))
      .filter((c): c is Category => !!c);
    if (cats.length > 0) groupedCategories.push(cats);
  }
  if (groupedCategories.length === 0) {
    return { error: 'Nessuna categoria valida selezionata' };
  }

  return {
    selections: cleanSelections,
    lang: queryLang,
    searchType: type.id,
    queryString: buildQueryString(groupedCategories, queryLang),
  };
}

router.post('/queries', async (req, res) => {
  const fields = await buildQueryFields(req.body);
  if ('error' in fields) return res.status(400).json({ error: fields.error });

  const query: Query = {
    id: randomUUID(),
    ...fields,
    createdAt: now(),
    executedAt: null,
  };
  await queries.append(query);
  res.status(201).json(query);
});

router.get('/queries/:id', async (req, res) => {
  const query = await queries.findById(req.params.id);
  if (!query) return res.status(404).json({ error: 'Query non trovata' });
  res.json(query);
});

// Modifica una query SOLO se non ancora eseguita; se eseguita → 409 (il client
// deve creare una nuova query).
router.put('/queries/:id', async (req, res) => {
  const existing = await queries.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Query non trovata' });
  if (existing.executedAt) {
    return res.status(409).json({
      error: 'Query già eseguita: è immutabile. Salvala come nuova query.',
    });
  }

  const fields = await buildQueryFields(req.body);
  if ('error' in fields) return res.status(400).json({ error: fields.error });

  const updated = await queries.update(existing.id, fields);
  res.json(updated);
});

// --- Ricerca ---
router.post('/queries/:id/search', async (req, res) => {
  const query = await queries.findById(req.params.id);
  if (!query) return res.status(404).json({ error: 'Query non trovata' });

  // I motori sono determinati dal tipo di ricerca della query.
  const type = getSearchType(query.searchType);
  // Si può restringere a un sottoinsieme dei motori del tipo via body.sources.
  const requested: SearchSource[] = Array.isArray(req.body?.sources)
    ? req.body.sources
    : type.engines;
  const sources = requested.filter((s) => type.engines.includes(s));
  const maxResults = Number(req.body?.maxResults) || 20;

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const engine = SEARCH_ENGINES[source];
      const raw = await engine.search(query.queryString, {
        maxResults,
        lang: query.lang,
        scopeHint: type.scopeHint,
      });
      return raw.map((r) => engine.toResult(query.id, r));
    })
  );

  const allResults: SearchResult[] = [];
  const perSource: Record<string, number | string> = {};
  settled.forEach((outcome, i) => {
    const source = sources[i];
    if (outcome.status === 'fulfilled') {
      allResults.push(...outcome.value);
      perSource[source] = outcome.value.length;
    } else {
      perSource[source] = `errore: ${outcome.reason?.message ?? 'sconosciuto'}`;
    }
  });

  // Rilanciare la stessa ricerca è un gesto naturale (il pulsante resta lì): senza
  // deduplicazione ogni rilancio raddoppierebbe i risultati e l'export si
  // ritroverebbe due copie dello stesso paper. Si scartano sia i doppioni rispetto
  // a quanto già salvato, sia quelli interni a questo stesso batch.
  const store = resultsStore(query.id);
  const seen = new Set((await store.readAll()).map(resultKey));
  const fresh = allResults.filter((r) => {
    const key = resultKey(r);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const duplicates = allResults.length - fresh.length;

  await store.appendMany(fresh);

  // Segna la query come eseguita (diventa immutabile) alla prima esecuzione.
  if (!query.executedAt) {
    await queries.update(query.id, { executedAt: now() });
  }

  res.json({
    queryId: query.id,
    queryString: query.queryString,
    searchType: type.id,
    total: fresh.length,
    duplicates,
    perSource,
  });
});

router.get('/queries/:id/results', async (req, res) => {
  const query = await queries.findById(req.params.id);
  if (!query) return res.status(404).json({ error: 'Query non trovata' });
  res.json(await resultsStore(query.id).readAll());
});

// Esporta i risultati selezionati in un file Markdown sotto data/notes/.
router.post('/queries/:id/export-notes', async (req, res) => {
  const query = await queries.findById(req.params.id);
  if (!query) return res.status(404).json({ error: 'Query non trovata' });

  const { resultIds, title } = req.body ?? {};
  if (!Array.isArray(resultIds) || resultIds.length === 0) {
    return res.status(400).json({ error: 'Nessun risultato selezionato' });
  }

  const all = await resultsStore(query.id).readAll();
  const idSet = new Set<string>(resultIds);
  const selected = all.filter((r) => idSet.has(r.id));
  if (selected.length === 0) {
    return res.status(400).json({ error: 'I risultati selezionati non esistono' });
  }

  const exportedAt = new Date();
  const noteTitle =
    typeof title === 'string' && title.trim() ? title.trim() : query.queryString;
  const fileName = `${slugify(noteTitle)}-${timestamp(exportedAt)}.md`;
  const md = buildResultsMarkdown({
    title: noteTitle,
    queryString: query.queryString,
    searchType: query.searchType,
    results: selected,
    exportedAt,
  });

  await writeTextFile(notesPath(fileName), md);

  res.status(201).json({
    file: fileName,
    relativePath: `data/notes/${fileName}`,
    count: selected.length,
  });
});

// --- Contenuto documento (Cowork WebFetch) ---
// Recupera il contenuto principale di un URL in Markdown.
router.post('/fetch-content', async (req, res) => {
  const { url, title } = req.body ?? {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url è obbligatorio' });
  }
  try {
    const markdown = await fetchContentAsMarkdown(url.trim(), title);
    res.json({ url, markdown });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Recupero contenuto fallito' });
  }
});

// Salva contenuto Markdown arbitrario in data/notes/.
router.post('/save-note', async (req, res) => {
  const { title, markdown } = req.body ?? {};
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return res.status(400).json({ error: 'markdown è obbligatorio' });
  }
  const noteTitle =
    typeof title === 'string' && title.trim() ? title.trim() : 'nota';
  const fileName = `${slugify(noteTitle)}-${timestamp(new Date())}.md`;
  await writeTextFile(notesPath(fileName), markdown);
  res.status(201).json({ file: fileName, relativePath: `data/notes/${fileName}` });
});

// Scarica il documento originale (PDF/HTML) e lo salva in data/documents/.
function extensionFor(contentType: string, url: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('html')) return 'html';
  if (ct.includes('json')) return 'json';
  if (ct.includes('plain')) return 'txt';
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : 'bin';
}

router.post('/download-document', async (req, res) => {
  const { url, title } = req.body ?? {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url è obbligatorio' });
  }
  try {
    const response = await fetchWithRetry(url.trim(), {}, { timeoutMs: 60000 });
    if (!response.ok) {
      return res.status(502).json({ error: `HTTP ${response.status} dal documento` });
    }
    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = extensionFor(contentType, url);
    const base = slugify(typeof title === 'string' && title.trim() ? title : url);
    const fileName = `${base}-${timestamp(new Date())}.${ext}`;
    await writeBinaryFile(documentsPath(fileName), buffer);
    res.status(201).json({
      file: fileName,
      relativePath: `data/documents/${fileName}`,
      contentType,
      bytes: buffer.length,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Download fallito' });
  }
});

export default router;
