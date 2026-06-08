// Modelli dominio del Research System (riscrittura in TypeScript del flusso
// descritto in analisi/research system.md: Tema → Categorie → Query → Risultati).

export type ThemeStatus = 'active' | 'archived';

export interface Theme {
  id: string;
  title: string;
  rawText: string;
  status: ThemeStatus;
  createdAt: string;
  updatedAt: string;
}

// Etichetta localizzata: stesso concetto, lingue diverse (es. en/it).
export interface LocalizedLabel {
  text: string;
  lang: string; // codice lingua ISO 639-1 (es. "en", "it")
}

// Le categorie sono raggruppate per "dimensione" (es. fascia d'età, setting,
// intervento), come da skill theme_category_extractor. Ogni categoria porta le
// proprie etichette in più lingue.
export interface Category {
  id: string;
  themeId: string;
  dimension: string;
  labels: LocalizedLabel[];
  createdAt: string;
}

// Assegnazione di una categoria a un gruppo AND (1..5). Le categorie con lo
// stesso `group` vengono combinate in OR; i gruppi tra loro in AND.
export interface QuerySelection {
  categoryId: string;
  group: number; // 1..5
}

export interface Query {
  id: string;
  // Le query NON sono legate a un singolo tema: le selezioni possono pescare
  // categorie da temi diversi.
  selections: QuerySelection[];
  lang: string; // lingua usata per costruire la query string
  searchType: string; // id del tipo di ricerca (vedi searchTypes.ts)
  queryString: string;
  createdAt: string;
  // Impostato alla prima esecuzione di una ricerca. Una query con executedAt
  // valorizzato è IMMUTABILE: modificarla crea una nuova query.
  executedAt: string | null;
}

export type SearchSource = 'zenodo' | 'semantic_scholar' | 'pubmed' | 'web';

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

export interface SearchParams {
  maxResults?: number;
  lang?: string;
  // Indicazione di scope per i motori web (es. "solo siti ufficiali ASL/USL…").
  scopeHint?: string;
}
