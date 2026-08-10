# localweb — Cosa fa questa webapp

> **Altri documenti:** [miglioramenti.md](miglioramenti.md) — cosa conviene sistemare
> e a che costo · [panorama-strumenti.md](panorama-strumenti.md) — strumenti esistenti
> con obiettivi simili.

## In una frase

**localweb** è un laboratorio personale che gira **solo sul computer di chi lo usa**:
raccoglie materiale di studio e ricerca da fonti esterne (database accademici, siti
istituzionali, YouTube) e lo trasforma in **file Markdown e JSON archiviati in locale**,
pronti per essere letti, rielaborati e conservati nel tempo.

Non è un servizio online: non ha login, non ha database cloud, non manda dati a
nessuno se non ai motori di ricerca che interroga su richiesta esplicita.

---

## Gli obiettivi

### 1. Ridurre l'attrito tra "mi interessa un tema" e "ho del materiale su cui lavorare"

Il percorso classico — pensare le parole chiave giuste, tradurle, interrogare un
database alla volta, copiare i riferimenti a mano — è lento e si perde per strada.
L'app comprime quel percorso in un flusso guidato in cui l'utente descrive
l'interesse **in linguaggio naturale** e ottiene risultati bibliografici già
raccolti e archiviati.

### 2. Rendere esplicita e riutilizzabile la logica di ricerca

Una ricerca non è un gesto usa-e-getta. Qui il tema, le categorie estratte e la
query costruita diventano **oggetti salvati e riconsultabili**: si può tornare
indietro, cambiare una combinazione, rilanciare. Una query già eseguita diventa
**immutabile**, così i risultati restano sempre riconducibili a come sono stati
ottenuti — se si vuole variare, si crea una query nuova.

### 3. Tenere i contenuti in un formato che sopravvive all'app

Tutto ciò che viene prodotto è **Markdown o JSONL su disco**, in cartelle leggibili
con qualsiasi editor. Le note esportate hanno un frontmatter compatibile con
Obsidian. L'obiettivo dichiarato è che l'archivio resti utile anche se un giorno
questa webapp sparisse.

### 4. Usare l'AI dove serve davvero il giudizio, non ovunque

Claude non viene interposto tra l'utente e i dati: interviene in punti precisi —
capire un tema e proporne le dimensioni concettuali, estrarre il contenuto
leggibile di una pagina web, condurre ricerche web mirate. Il resto (archiviazione,
composizione delle query, esecuzione delle ricerche) è codice deterministico e
ispezionabile.

### 5. Restare locale per scelta, non per limite

L'assenza di account, permessi e infrastruttura è il punto: l'app si avvia in due
comandi, i dati sono nella cartella del progetto, e ogni nuova funzione può essere
aggiunta senza pensare a deploy, sicurezza multi-utente o costi di hosting.

---

## Le due sezioni operative

### Research System — ricerca bibliografica assistita

Il cuore dell'app. Il flusso in cinque passi:

| # | Passo         | Cosa succede                                                                 |
|---|---------------|------------------------------------------------------------------------------|
| 1 | **Tema**      | Si descrive l'interesse in linguaggio naturale, senza formalismi.             |
| 2 | **Categorie** | Claude legge il tema e ne estrae le *dimensioni* concettuali (fascia d'età, setting, tipo di intervento…), ciascuna con etichette multilingua. |
| 3 | **Query**     | Si assegnano le categorie a gruppi: dentro il gruppo vale l'**OR**, tra gruppi l'**AND**. Ne esce una query booleana leggibile. |
| 4 | **Ricerca**   | La query viene lanciata in parallelo sui motori previsti dal tipo di ricerca scelto. |
| 5 | **Risultati** | Tutto viene salvato in JSONL; da lì si esportano note Markdown, si recupera il testo di una pagina o si scarica il documento originale. |

**Tre tipi di ricerca**, che determinano quali motori vengono interrogati:

- **Accademico** — Zenodo, Semantic Scholar, PubMed: paper e dataset.
- **Web istituzionale** — ricerca ristretta a fonti ufficiali italiane (ASL e
  aziende sanitarie, Regioni, Comuni, Ministero della Salute, ISS, domini `.gov.it`),
  escludendo blog e social. Serve a trovare iniziative e materiali reali, non
  letteratura.
- **Web generico** — ricerca libera, senza vincoli di dominio.

Il risultato non resta chiuso nell'app: si seleziona ciò che interessa e lo si
esporta come nota Markdown, oppure si archivia il documento sorgente (PDF/HTML)
sul disco.

### YouTube Transcript — recupero trascrizioni

Da un URL di un video si ottiene la trascrizione, riorganizzata in paragrafi
leggibili (non il muro di sottotitoli) e salvata come nota Markdown con
frontmatter. Se la lingua richiesta non esiste, l'app propone quelle disponibili
invece di fallire e basta.

L'obiettivo è lo stesso del Research System: **portare una fonte esterna dentro
l'archivio personale in un formato lavorabile.**

---

## Dove finiscono i dati

```
data/
├── notes/       note Markdown esportate (compatibili Obsidian)
├── documents/   documenti originali scaricati (PDF, HTML)
├── research/    temi, categorie, query e risultati in JSONL
└── json/        dati JSON generici
```

L'intento è che i contenuti prodotti dall'uso quotidiano **restino privati sulla
macchina** e fuori da git. Oggi `research/` e `documents/` sono ignorati, mentre
`notes/` è ancora versionato — vedi [miglioramenti.md](miglioramenti.md).

---

## Impostazione tecnica — l'essenziale

- **Server**: Node + Express + TypeScript, porta `4317`, API sotto `/api`.
- **Client**: React + Vite + TypeScript + Tailwind, porta `5180`.
- **Persistenza**: file su disco (Markdown, JSONL). Nessun database.
- **AI**: i job Claude vivono in `cowork_jobs/`, lanciati per *spawn* dal server.

```bash
npm install     # installa tutti i workspace
npm run dev     # server (4317) + client (5180)
```

Poi si apre <http://localhost:5180>. La home esegue un ping al server e mostra se
la connessione è viva.

Configurazione opzionale in `server/.env` (copiare da `server/.env.example`): porta,
CORS, cartella dati, timeout dei job.

I job Claude **non richiedono una `ANTHROPIC_API_KEY`**: il server lancia la CLI
`claude` come sottoprocesso e sfrutta l'autenticazione già presente di Claude Code.

---

## Come evolve

L'app è organizzata per **sezioni indipendenti** (Research System, YouTube
Transcript): ognuna ha le sue pagine, le sue rotte server e la sua area dati.
Aggiungerne una nuova non tocca le esistenti — ed è il modo previsto per far
crescere il progetto man mano che emergono nuove fonti da portare nell'archivio.
