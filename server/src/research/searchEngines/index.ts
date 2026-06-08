import { SearchEngine } from './base';
import { ZenodoSearch } from './zenodo';
import { SemanticScholarSearch } from './semanticScholar';
import { PubMedSearch } from './pubmed';
import { WebSearch } from './web';
import type { SearchSource } from '../models';

export const SEARCH_ENGINES: Record<SearchSource, SearchEngine> = {
  zenodo: new ZenodoSearch(),
  semantic_scholar: new SemanticScholarSearch(),
  pubmed: new PubMedSearch(),
  web: new WebSearch(),
};

export const ALL_SOURCES: SearchSource[] = [
  'zenodo',
  'semantic_scholar',
  'pubmed',
  'web',
];

export { SearchEngine };
