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

## Le sezioni operative

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

Oltre al singolo video si può lavorare per **canale**: dal feed pubblico di
YouTube si leggono gli **ultimi 15 video** e se ne scaricano le trascrizioni in
blocco. Lo stato di ogni video resta in archivio, quindi rilanciare più avanti
scarica **solo i video nuovi** invece di rifare tutto.

Le sorgenti dell'elenco sono due e l'app sceglie da sé. Senza configurazione usa
il **feed RSS pubblico**: nessuna chiave, ma un tetto fisso di 15 video, non
paginabile. Se in `server/.env` c'è una `API_KEY_YOUTUBE`, passa alla **YouTube
Data API v3** e il tetto cade: si risale indietro nella cronologia quanto si
vuole. La chiave è gratuita e non richiede fatturazione — 10.000 unità di quota
al giorno, di cui ne serve circa 1 ogni 50 video.

Le trascrizioni, invece, l'API ufficiale non le dà affatto per i canali altrui —
`captions.download` richiede di essere proprietari del video — quindi quella
parte passa comunque dall'endpoint pubblico, con o senza chiave.

L'obiettivo è lo stesso del Research System: **portare una fonte esterna dentro
l'archivio personale in un formato lavorabile.**

### Reports — pagine di consultazione già pronte

Una volta che le trascrizioni di un canale sono sul disco, il lavoro di sintesi
produce due cose distinte: un **corpus analizzato** in JSON, uno per canale, e
una **pagina HTML autonoma** — un solo file, senza dipendenze — che lo rende
navigabile. L'app li elenca e li mostra, ma non li genera e non ne conosce la
struttura: sono materiale scritto a mano.

Perché una pagina a sé e non una schermata React: la sintesi deve restare
leggibile anche fuori dall'app, passata a qualcun altro o aperta da sola,
esattamente come le note Markdown. L'app la incornicia, non la possiede.

Entrambi stanno in `reports/`, **versionato in git**:

```
reports/
├── viewer/index.html                    il visualizzatore, uno per tutti i canali
└── youtube/<channelId>/synthesis.json   il corpus analizzato, uno per canale
```

La separazione non è cosmetica. La pagina è codice, e tenerne una copia per
canale significherebbe riallinearle a mano a ogni correzione. Il corpus è il
prodotto di un lavoro di analisi che *non si rigenera da sé*, a differenza delle
trascrizioni: se vivesse sotto `data/`, un `git clone` su un'altra macchina
lascerebbe l'app senza nulla da mostrare. Le trascrizioni grezze, che invece si
riscaricano dal canale, restano in `data/youtube/` e fuori da git.

A tenerli insieme è il server: serve la pagina come
`/api/reports/view/<channelId>/index.html` e il corpus come
`.../synthesis.json`, così la pagina lo trova con un `fetch('./synthesis.json')`
relativo pur non avendolo accanto sul disco. Appena esiste un
`reports/youtube/<channelId>/synthesis.json`, il report compare nel menù
*Reports* — con il titolo letto da `meta.title` del corpus. Fuori da quei due
percorsi non viene esposto nulla.

---

## Dove finiscono i dati

```
data/
├── notes/       note Markdown esportate (compatibili Obsidian)
├── documents/   documenti originali scaricati (PDF, HTML)
├── research/    temi, categorie, query e risultati in JSONL
├── youtube/     trascrizioni per canale + index.jsonl con lo stato di ogni video
└── json/        dati JSON generici
```

Fuori da `data/`, e **dentro** git, c'è invece `reports/`: il visualizzatore e i
corpus analizzati (vedi [Reports](#reports--pagine-di-consultazione-già-pronte)).
Il criterio è se la cosa si ricostruisce da sola: le trascrizioni si riscaricano
dal canale, un'analisi scritta a mano no.

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
Transcript, Reports): ognuna ha le sue pagine, le sue rotte server e la sua area
dati.
Aggiungerne una nuova non tocca le esistenti — ed è il modo previsto per far
crescere il progetto man mano che emergono nuove fonti da portare nell'archivio.
