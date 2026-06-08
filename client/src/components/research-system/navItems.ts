// Configurazione della sezione "Research System".
// Sistema di ricerca bibliografica assistito da Claude
// (Tema → Categorie → Query → Ricerca → Risultati). Il flusso descritto in
// `analisi/research system.md` è stato integrato nel server Node locale:
// gli endpoint vivono sotto /api/research (porta del server, via proxy Vite).

export const RESEARCH_SYSTEM_BASE = '/research-system';

export interface ResearchSystemSection {
  slug: string;
  label: string; // voce nella sotto-barra
  title: string; // titolo della pagina
  summary: string; // descrizione breve (card della landing)
}

// Step del flusso di ricerca, nell'ordine in cui vengono percorsi.
export const RESEARCH_SYSTEM_SECTIONS: ResearchSystemSection[] = [
  {
    slug: 'temi',
    label: 'Temi',
    title: 'Temi di ricerca',
    summary:
      'Punto di partenza: un interesse di ricerca espresso in linguaggio naturale (titolo + testo libero). Da qui nasce tutto il flusso.',
  },
  {
    slug: 'categorie',
    label: 'Categorie',
    title: 'Estrazione categorie',
    summary:
      'Claude (via Cowork) estrae dal tema le categorie rilevanti, raggruppate per dimensione (es. fascia d’età, setting, intervento).',
  },
  {
    slug: 'query',
    label: 'Query',
    title: 'Costruzione query',
    summary:
      'Le categorie selezionate vengono combinate in una query string strutturata (gruppi AND/OR), pronta per i motori di ricerca.',
  },
  {
    slug: 'risultati',
    label: 'Risultati',
    title: 'Ricerca e risultati',
    summary:
      'La query viene lanciata sui motori del tipo di ricerca scelto; i risultati vengono salvati in locale (JSONL) e selezionabili per l’export.',
  },
];
