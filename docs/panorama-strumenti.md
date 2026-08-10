# Panorama: strumenti che perseguono obiettivi simili

Ricerca svolta ad **agosto 2026**. L'obiettivo non è stilare una classifica, ma
capire **quale spazio occupa localweb** rispetto a ciò che esiste già, e da cosa
conviene farsi ispirare invece che reinventare.

Gli obiettivi di localweb — vedi [README.md](README.md) — sono tre e vanno tenuti
insieme: ricerca bibliografica assistita da AI, **archivio locale in formati aperti**,
nessuna infrastruttura. Quasi tutti gli strumenti là fuori ne coprono bene uno o due,
raramente tutti e tre.

---

## 1. Ricerca bibliografica assistita da AI (SaaS)

È l'area più affollata e più matura. Tutti condividono un tratto: sono **servizi
cloud**, il corpus e le query stanno sui loro server.

| Strumento | Cosa fa meglio | Modello |
|---|---|---|
| **[Elicit](https://paperguide.ai/blog/ai-tools-for-literature-review/)** | Screening sistematico su larga scala (fino a ~5.000 paper sul piano Pro) ed estrazione in **tabelle di dati** strutturate | SaaS, freemium |
| **[Consensus](https://thedrive.ai/blog/elicit-vs-consensus-ai-research-tools)** | Discovery guidata da ipotesi: risponde sì/no a una domanda sintetizzando i *findings* degli studi | SaaS, freemium |
| **[ResearchRabbit](https://effortlessacademic.com/litmaps-vs-researchrabbit-vs-connected-papers-the-best-literature-review-tool-in-2025/)** | Grafo delle citazioni a partire da un insieme *seed* di paper; esplorazione visuale | SaaS, gratuito |
| **[Undermind](https://library.ku.ac.ae/aitools/aidiscovery)** | Ricerca **ricorsiva** e più profonda, forte in ambito biomedico | SaaS, freemium |
| **Litmaps / Connected Papers** | Mappe visuali di vicinanza tra lavori | SaaS, freemium |

**Il punto da notare:** Elicit, Consensus e Undermind poggiano in larga parte sugli
**stessi indici** (Semantic Scholar e affini) su cui poggia localweb. La differenza
non sta nei dati, sta nel livello sopra: tabelle strutturate per Elicit, risposte
sintetiche per Consensus, ricorsione per Undermind.

**Cosa significa per localweb.** Sul *reperimento* non c'è vantaggio competitivo da
inseguire — la fonte è la stessa. La differenza è che qui la ricerca è **spiegabile e
riproducibile**: la query booleana è visibile, le categorie che l'hanno generata sono
salvate, e la query eseguita è immutabile. Elicit e Consensus danno un risultato
migliore ma più opaco. È una differenza di scopo, non di qualità.

**Cosa vale la pena rubare:** la **ricorsione di Undermind** (i risultati del primo
giro suggeriscono categorie per il secondo) è l'idea più compatibile con il flusso
esistente — si innesterebbe tra il passo 5 e un nuovo passo 2.

---

## 2. Archivio locale e knowledge base (Obsidian, Zotero)

Qui localweb non compete: **converge**. L'export in Markdown con frontmatter è
esplicitamente pensato per finire in una vault.

- **[Obsidian](https://www.oflight.co.jp/en/columns/obsidian-knowledge-management-guide-2026)**
  — note come file Markdown in una cartella locale, niente va nel cloud se non attivi
  un sync. È lo stesso principio di localweb, applicato alla scrittura invece che alla
  raccolta.
- **Zotero** — gestione dei riferimenti e delle annotazioni, con integrazione Obsidian
  consolidata. La divisione di ruoli che emerge dalla pratica è netta: **le fonti
  stanno in Zotero, il pensiero sta in Obsidian**.
- **Pipeline offline completa** — c'è chi mette insieme
  [Zotero + Obsidian + LM Studio](https://jmexplorer.medium.com/no-wifi-no-problem-an-offline-research-pipeline-with-zotero-obsidian-and-lm-studio-36d66bf29ba8)
  per lavorare senza rete, con il modello che gira in locale.
- **Plugin rilevanti**: *Dataview* (interroga la vault con sintassi SQL-like),
  *Citations* (aggancia Zotero).

**Cosa significa per localweb.** In quella divisione di ruoli — fonti in Zotero,
pensiero in Obsidian — localweb sta **a monte di entrambi**: è la fase di
*reperimento*, che né Zotero né Obsidian coprono. Il pezzo mancante è l'aggancio:

> **Esportare anche in formato BibTeX o CSL-JSON**, oltre al Markdown, renderebbe i
> risultati importabili in Zotero con un click. I campi necessari (`title`, `authors`,
> `year`, `doi`, `url`, `abstract`) sono **già tutti** nel modello `SearchResult`.
> È probabilmente il singolo intervento con il miglior rapporto valore/costo per
> integrarsi con l'ecosistema esistente.

---

## 3. Aggregatori di ricerca accademica open source

- **[paper-search-mcp](https://github.com/openags/paper-search-mcp)** — il confronto
  più diretto. Cerca e scarica paper da un elenco molto più ampio di fonti (arXiv,
  PubMed, bioRxiv, medRxiv, Semantic Scholar, Crossref, OpenAlex, PMC, CORE, Europe PMC,
  DOAJ, BASE, Zenodo, HAL, SSRN, Unpaywall…), con priorità alle fonti aperte. Disponibile
  come **MCP server**, CLI e Skill — quindi utilizzabile direttamente da Claude.
- **[OpenAlex](https://intuitionlabs.ai/articles/openalex-semantic-scholar-pubmed-comparison)**
  — indice aperto e gratuito, spesso con copertura più ampia di Semantic Scholar.

**Cosa significa per localweb.** Qui c'è una sovrapposizione reale, e va detta con
franchezza: sul puro "interroga N motori accademici", `paper-search-mcp` copre
**molte più fonti** con meno codice da mantenere. Ciò che localweb ha in più è il
flusso a monte (tema → categorie → query booleana) e a valle (export, note, download),
che quel tool non ha e non vuole avere.

**Due mosse concrete:**
- **OpenAlex come quarto motore** — API aperta, nessuna chiave, copertura ampia.
  Aggiungerlo significa una classe nuova sotto `searchEngines/`, che è esattamente
  ciò per cui quell'astrazione esiste.
- **Valutare `paper-search-mcp` come motore** invece di scrivere altri client a mano:
  il server già lancia Claude via spawn, e un MCP si innesterebbe nella stessa logica.

---

## 4. Agenti di ricerca autonomi open source

- **[GPT Researcher](https://gptr.dev/)** — il più adottato (~28k stelle su GitHub a
  metà 2026). Produce report multi-fonte con citazioni inline. Architettura a tre ruoli:
  un *Planner* che trasforma il brief in domande di ricerca, *Execution Agents* che
  esplorano il web in parallelo, un *Publisher* che aggrega.
- **[Local Deep Research](https://www.digitalapplied.com/blog/open-source-deep-research-agents-2026-guide)**
  — gira interamente su infrastruttura locale con Ollama come backend di inferenza,
  pensato per contesti in cui le query non possono uscire dalla macchina.
- **Stanford STORM, Agent Laboratory, AI-Researcher** — più vicini alla visione del
  "ricercatore autonomo": arrivano fino alla scrittura del report e alla progettazione
  degli esperimenti.

**Cosa significa per localweb.** È la differenza filosofica più netta di tutto il
panorama. Questi agenti **decidono al posto tuo** come scomporre la ricerca; localweb
mette la scomposizione in mano all'utente e usa Claude solo per proporre le dimensioni
concettuali. La struttura Planner/Execution/Publisher di GPT Researcher assomiglia al
flusso in cinque passi — ma lì è automatica e opaca, qui è manuale e ispezionabile.

Se un domani volessi un "modo veloce" accanto al flusso guidato, quello è il modello
da imitare: **come alternativa esplicita**, non come sostituzione. Il valore attuale
sta proprio nel controllo.

---

## 5. Trascrizioni YouTube

Qui la sovrapposizione è totale e conviene saperlo.

- **[YouTube Transcript Fetcher](https://community.obsidian.md/plugins/youtube-transcript-fetcher)**
  (plugin Obsidian) — salva in Markdown, PDF o SRT; timestamp configurabili, metadati
  del video estratti automaticamente, **prevenzione dei duplicati**, selezione lingua
  con fallback automatico all'inglese.
- **[YTranscript](https://www.obsidianstats.com/plugins/ytranscript)** — trascrizione in
  un pannello laterale con marcatori temporali, drag-and-drop delle righe nelle note.
- **[youtube-fetcher-to-markdown](https://github.com/JimmySadek/youtube-fetcher-to-markdown)**
  — Skill per Claude Code: da un link produce Markdown pronto per Obsidian con
  metadati completi, **capitoli** e trascrizione.
- **TranscribeYT** — servizio web con export .md e riassunto AI.

**Valutazione onesta.** La sezione YouTube di localweb fa **meno** di questi strumenti:
niente metadati del video (titolo, canale, data, durata), niente capitoli, niente
timestamp, nessuna prevenzione dei duplicati. Ha in comune con loro il fallback di
lingua, che è implementato bene (propone le lingue disponibili invece di fallire).

**La domanda giusta non è "come recuperare il divario"**, ma: la sezione esiste per
comodità dentro un flusso già aperto, o vuole essere lo strumento principale? Se la
prima, va benissimo così. Se la seconda, i **metadati del video e i capitoli** sono
il primo divario da colmare, perché sono ciò che rende la nota utile a distanza di mesi.

---

## Sintesi: dove sta localweb

Nessuno degli strumenti trovati tiene insieme le tre cose contemporaneamente.

| | Ricerca AI | Archivio locale aperto | Zero infrastruttura |
|---|:---:|:---:|:---:|
| Elicit / Consensus / Undermind | ✅ | ❌ | ✅ (ma cloud) |
| Obsidian + Zotero | ❌ | ✅ | ✅ |
| paper-search-mcp | parziale | ✅ | ✅ |
| GPT Researcher | ✅ | parziale | ⚠️ (setup) |
| **localweb** | ✅ | ✅ | ✅ |

Lo spazio esiste, ma è **stretto e va difeso con precisione**. Il vantaggio non è
"cerca meglio" — su quello Elicit e Undermind vincono, e usano gli stessi indici. Il
vantaggio è che qui **il ragionamento che ha prodotto i risultati resta visibile e
riutilizzabile**, e il materiale finisce in file che sopravvivono all'app.

### Tre spunti in ordine di valore/costo

1. **Export BibTeX / CSL-JSON** — apre la strada a Zotero, e i dati necessari ci sono
   già tutti. Costo minimo, rende localweb un cittadino dell'ecosistema invece che
   un'isola.
2. **OpenAlex come quarto motore** — copertura ampia, API aperta senza chiave, e
   l'astrazione `SearchEngine` è già pronta ad accoglierlo.
3. **Un secondo giro di categorie a partire dai risultati** (l'idea ricorsiva di
   Undermind) — è l'unico punto in cui la ricerca assistita qui è più povera dei
   concorrenti diretti.

---

## Fonti

- [7 Best Literature Review AI Tools in 2026](https://paperguide.ai/blog/ai-tools-for-literature-review/)
- [Deep Research Tools — Khalifa University LibGuides](https://library.ku.ac.ae/aitools/aidiscovery)
- [Litmaps vs ResearchRabbit vs Connected Papers](https://effortlessacademic.com/litmaps-vs-researchrabbit-vs-connected-papers-the-best-literature-review-tool-in-2025/)
- [Elicit vs Consensus vs Semantic Scholar (2026)](https://thedrive.ai/blog/elicit-vs-consensus-ai-research-tools)
- [Obsidian for Research: Tools and Workflow Fit in 2026](https://www.atlasworkspace.ai/blog/obsidian-for-research)
- [An offline research pipeline with Zotero, Obsidian and LM Studio](https://jmexplorer.medium.com/no-wifi-no-problem-an-offline-research-pipeline-with-zotero-obsidian-and-lm-studio-36d66bf29ba8)
- [Complete Guide to Obsidian 2026 — Local-First PKM](https://www.oflight.co.jp/en/columns/obsidian-knowledge-management-guide-2026)
- [paper-search-mcp (GitHub)](https://github.com/openags/paper-search-mcp)
- [OpenAlex vs Semantic Scholar vs PubMed](https://intuitionlabs.ai/articles/openalex-semantic-scholar-pubmed-comparison)
- [GPT Researcher](https://gptr.dev/)
- [Four Open-Source Deep Research Agents, Tested Honestly](https://www.digitalapplied.com/blog/open-source-deep-research-agents-2026-guide)
- [Best Open-Source AI Research Agents in 2026](https://blog.gatsbi.com/wordsmith/best-open-source-ai-research-agents/)
- [YouTube Transcript Fetcher — Obsidian Plugin](https://community.obsidian.md/plugins/youtube-transcript-fetcher)
- [YTranscript — Obsidian Plugin](https://www.obsidianstats.com/plugins/ytranscript)
- [youtube-fetcher-to-markdown (GitHub)](https://github.com/JimmySadek/youtube-fetcher-to-markdown)
- [YouTube to Markdown: The Complete Guide](https://transcribeyt.com/blog/youtube-to-md-the-complete-guide)
