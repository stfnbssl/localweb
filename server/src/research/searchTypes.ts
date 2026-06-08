import type { SearchSource } from './models';

export type SearchTypeId = 'academic' | 'web_official' | 'web_general';

export interface SearchTypeDef {
  id: SearchTypeId;
  label: string;
  description: string;
  engines: SearchSource[];
  // Indicazione di scope passata ai motori web (instradata nel job Cowork).
  scopeHint?: string;
}

export const SEARCH_TYPES: Record<SearchTypeId, SearchTypeDef> = {
  academic: {
    id: 'academic',
    label: 'Accademico',
    description: 'Paper e dataset da database accademici.',
    engines: ['zenodo', 'semantic_scholar', 'pubmed'],
  },
  web_official: {
    id: 'web_official',
    label: 'Web istituzionale',
    description:
      'Iniziative e materiali su siti ufficiali del settore pubblico/sanitario italiano.',
    engines: ['web'],
    scopeHint:
      'Limita la ricerca a SITI UFFICIALI ITALIANI del settore pubblico e sanitario: ASL/USL e Aziende Sanitarie (es. domini aziende sanitarie locali), Regioni, Comuni, Ministero della Salute, Istituto Superiore di Sanità, e in generale domini .gov.it e siti istituzionali. Scarta blog, social e fonti non ufficiali.',
  },
  web_general: {
    id: 'web_general',
    label: 'Web generico',
    description: 'Ricerca web libera, senza restrizione di dominio.',
    engines: ['web'],
  },
};

export const DEFAULT_SEARCH_TYPE: SearchTypeId = 'academic';

export function getSearchType(id: string): SearchTypeDef {
  return (SEARCH_TYPES as Record<string, SearchTypeDef>)[id] ?? SEARCH_TYPES[DEFAULT_SEARCH_TYPE];
}
