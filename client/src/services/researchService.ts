import { apiRequest } from './apiClient';

export interface Theme {
  id: string;
  title: string;
  rawText: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface LocalizedLabel {
  text: string;
  lang: string;
}

export interface Category {
  id: string;
  themeId: string;
  dimension: string;
  labels: LocalizedLabel[];
  createdAt: string;
}

export interface QuerySelection {
  categoryId: string;
  group: number; // 1..5
}

export interface Query {
  id: string;
  selections: QuerySelection[];
  lang: string;
  searchType: string;
  queryString: string;
  createdAt: string;
  executedAt: string | null;
}

export type SearchSource = 'zenodo' | 'semantic_scholar' | 'pubmed' | 'web';

export interface SearchType {
  id: string;
  label: string;
  description: string;
  engines: SearchSource[];
  scopeHint?: string;
}

export interface SearchResult {
  id: string;
  queryId: string;
  source: SearchSource;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  fetchedAt: string;
}

export interface SearchSummary {
  queryId: string;
  queryString: string;
  // Risultati effettivamente salvati (esclusi i duplicati già presenti).
  total: number;
  // Quanti risultati sono stati scartati perché già salvati in precedenza.
  duplicates: number;
  // Conteggio grezzo per motore, prima della deduplicazione.
  perSource: Record<string, number | string>;
}

// --- Temi ---
export const listThemes = () => apiRequest<Theme[]>('/research/themes');

export const getTheme = (id: string) =>
  apiRequest<Theme>(`/research/themes/${id}`);

export const createTheme = (title: string, rawText: string) =>
  apiRequest<Theme>('/research/themes', {
    method: 'POST',
    body: JSON.stringify({ title, rawText }),
  });

// --- Categorie ---
export const listCategories = (themeId: string) =>
  apiRequest<Category[]>(`/research/themes/${themeId}/categories`);

// Tutte le categorie (di ogni tema) — pool per la costruzione query.
export const listAllCategories = () =>
  apiRequest<Category[]>('/research/categories');

export const extractCategories = (themeId: string) =>
  apiRequest<Category[]>(`/research/themes/${themeId}/extract-categories`, {
    method: 'POST',
  });

export const listSearchTypes = () =>
  apiRequest<SearchType[]>('/research/search-types');

// --- Query ---
export interface QueryInput {
  selections: QuerySelection[];
  lang: string;
  searchType: string;
}

export const createQuery = (input: QueryInput) =>
  apiRequest<Query>('/research/queries', {
    method: 'POST',
    body: JSON.stringify(input),
  });

// Aggiorna una query non ancora eseguita. Se eseguita, il server risponde 409.
export const updateQuery = (id: string, input: QueryInput) =>
  apiRequest<Query>(`/research/queries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const listQueries = () => apiRequest<Query[]>('/research/queries');

export const getQuery = (id: string) =>
  apiRequest<Query>(`/research/queries/${id}`);

// --- Ricerca ---
export const launchSearch = (
  queryId: string,
  body: { sources?: SearchSource[]; maxResults?: number } = {}
) =>
  apiRequest<SearchSummary>(`/research/queries/${queryId}/search`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getResults = (queryId: string) =>
  apiRequest<SearchResult[]>(`/research/queries/${queryId}/results`);

export interface ExportNotesResult {
  file: string;
  relativePath: string;
  count: number;
}

export const exportNotes = (
  queryId: string,
  resultIds: string[],
  title?: string
) =>
  apiRequest<ExportNotesResult>(`/research/queries/${queryId}/export-notes`, {
    method: 'POST',
    body: JSON.stringify({ resultIds, title }),
  });

// Recupera il contenuto principale di un URL in Markdown (via Cowork WebFetch).
export const fetchContent = (url: string, title?: string) =>
  apiRequest<{ url: string; markdown: string }>('/research/fetch-content', {
    method: 'POST',
    body: JSON.stringify({ url, title }),
  });

// Salva contenuto Markdown in data/notes.
export const saveNote = (title: string, markdown: string) =>
  apiRequest<{ file: string; relativePath: string }>('/research/save-note', {
    method: 'POST',
    body: JSON.stringify({ title, markdown }),
  });

// Scarica il documento originale (PDF/HTML) in data/documents.
export const downloadDocument = (url: string, title?: string) =>
  apiRequest<{
    file: string;
    relativePath: string;
    contentType: string;
    bytes: number;
  }>('/research/download-document', {
    method: 'POST',
    body: JSON.stringify({ url, title }),
  });

export const listEngines = () =>
  apiRequest<{ sources: SearchSource[] }>('/research/engines');
