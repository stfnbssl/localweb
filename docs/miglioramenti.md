# Cosa è migliorabile a basso costo

Giudizio basato sulla lettura del codice al commit `1483bbb`. Il criterio è
**rapporto valore/costo**: qui sotto solo interventi che stanno in poche decine di
righe o in una manciata di minuti. In fondo trovi ciò che ho **escluso** perché
troppo costoso o prematuro.

Il progetto è in buona salute: separazione netta client/server, motori di ricerca
dietro un'astrazione pulita (`SearchEngine`), commenti in italiano che spiegano il
*perché* e non il *cosa*, gestione degli errori per singolo motore con
`Promise.allSettled` invece del tutto-o-niente. I punti sotto sono rifiniture, non
riscritture.

---

## 1. I risultati si duplicano se rilanci la stessa ricerca ✅ FATTO

**Il problema.** `POST /api/research/queries/:id/search` fa `appendMany` sui
risultati (`routes/research.ts:258`) e ogni risultato riceve un `randomUUID` nuovo
(`searchEngines/base.ts:21`). Non c'è deduplicazione né lato server né lato client.
Rilanciare la ricerca sulla stessa query — cosa naturale, il pulsante resta lì e la
query resta selezionata — **raddoppia i risultati**, e la selezione per l'export si
ritrova due copie identiche di ogni paper.

**Perché conta.** È l'unico punto in cui l'app produce silenziosamente dati sbagliati.
Tutto il resto degrada in modo visibile.

**Fix economico.** Prima di `appendMany`, leggere i risultati già presenti e scartare
quelli con la stessa chiave logica — `source` + (`doi` ?? `url` ?? titolo
normalizzato). Una funzione di ~15 righe in `routes/research.ts`. In alternativa, id
deterministico (hash della chiave) al posto di `randomUUID` in `base.ts`, che rende
l'append idempotente per costruzione.

**Costo:** ~20 righe. **Valore:** alto.

> **Risolto.** `resultKey()` in `routes/research.ts` costruisce la chiave logica
> (`source` + doi/url/titolo normalizzato) e l'endpoint di ricerca filtra i doppioni
> sia contro quanto già salvato sia dentro lo stesso batch. La risposta espone
> `duplicates` e la UI lo mostra ("N nuovi risultati (M già presenti, scartati)"),
> così un rilancio che non aggiunge nulla si spiega da sé invece di sembrare un guasto.

---

## 2. Le note personali finiscono su GitHub ✅ FATTO

**Il problema.** `.gitignore` esclude `/data/research/` e `/data/documents/`, ma **non**
`/data/notes/`. E `git ls-files` mostra che due note prodotte dall'uso reale sono già
versionate:

```
data/notes/prima-selezione-20260603-142935.md
data/notes/seconda-20260603-144652.md
```

Sono esattamente il tipo di contenuto che il progetto dichiara di voler tenere locale.
Il repo è pubblico su GitHub.

**Fix economico.**

```bash
git rm --cached "data/notes/prima-selezione-20260603-142935.md" \
                "data/notes/seconda-20260603-144652.md"
# in .gitignore:
/data/notes/*.md
```

Il `.gitkeep` resta, così la cartella continua a esistere in un clone pulito.

**Nota:** i file restano nella storia dei commit precedenti. Se il contenuto è
sensibile serve una riscrittura della storia — quella *non* è economica. Se invece è
solo "rumore", basta rimuoverli d'ora in avanti.

**Costo:** 2 comandi. **Valore:** alto se il contenuto è personale.

> **Risolto.** Le due note sono uscite dal tracking (`git rm --cached`, restano su
> disco) e `.gitignore` ora contiene `/data/notes/*.md`. Il contenuto delle due note
> era costituito da riferimenti a paper accademici pubblici, quindi la storia git
> **non** è stata riscritta: non c'era nulla di sensibile da cancellare.

---

## 3. Documentazione che si contraddice sull'API key ✅ FATTO

`server/src/index.ts:54` dice, correttamente, che l'estrazione categorie avviene via
spawn della CLI `claude` e che **non serve** `ANTHROPIC_API_KEY`. Ma la schermata
Research System dice l'opposto all'utente:

> L'estrazione delle categorie richiede una `ANTHROPIC_API_KEY` in `server/.env`.
> — `client/src/pages/research-system/ResearchSystemHome.tsx:103-107`

Il codice dà ragione a `index.ts`: `coworkExtractor.ts` chiama `runCoworkJob`, che fa
`spawn('claude', ...)` e usa l'autenticazione già presente di Claude Code. La UI è
rimasta indietro rispetto a un cambio di architettura.

**Fix economico.** Riscrivere quel paragrafo della UI. Chi segue l'istruzione attuale
va a cercare una chiave che non gli serve.

**Costo:** 3 righe di JSX. **Valore:** medio-alto (è il primo ostacolo per chiunque
riprenda il progetto tra sei mesi).

> **Risolto.** `ResearchSystemHome.tsx` ora dice che non serve alcuna API key e che
> il server lancia la CLI `claude` già autenticata sulla macchina.

---

## 4. `analisi/research system.md` descrive un'app che non esiste

Il documento versionato descrive un'architettura **Python + FastAPI + PostgreSQL**,
con moduli `claude_code/core/models.py`, avvio su porta 8000 e un client TypeScript
che punta a `localhost:8000`. L'implementazione reale è Node + Express su 4317, con
storage JSONL. È il piano di deployment di una versione precedente, mai realizzata
così.

**Fix economico.** Rinominare in `analisi/ARCHIVIO-research-system-python.md` con due
righe in testa ("piano storico, non riflette l'implementazione attuale"), oppure
eliminarlo — la storia git lo conserva comunque.

**Costo:** 1 minuto. **Valore:** medio. Un documento tecnico obsoleto e non marcato
come tale costa più di uno assente, perché viene creduto.

---

## 5. Nessun test, e ci sono due punti che li meritano ✅ FATTO

Non esiste alcun test nel repo, né uno script `test`. Non serve una suite: bastano
due file su ciò che è **logica pura e fragile**.

- **`buildQueryString`** (`research/queryBuilder.ts`) — è una funzione pura senza I/O,
  ed è il cuore semantico dell'app: se sbaglia AND/OR, ogni ricerca a valle è
  sbagliata in modo *plausibile*, cioè difficile da notare. 6-7 casi la coprono
  interamente (gruppo singolo, gruppi multipli, etichetta mancante nella lingua
  richiesta, duplicati, gruppi vuoti).
- **I parser dell'output di Claude** — `parseResult` (`coworkExtractor.ts:38`) e
  `parseResults` (`searchEngines/web.ts:38`). Sono l'unico punto in cui entra testo
  non fidato generato da un modello. Casi utili: JSON dentro un fence ```` ```json ````,
  JSON nudo, array al top level *vs* oggetto con chiave `categories`/`results`, campi
  con tipo sbagliato.

**Fix economico.** `vitest` + due file, ~60 righe totali, nessun mock e nessuna rete
perché entrambe le funzioni sono sincrone e pure.

**Costo:** ~1 ora. **Valore:** alto in prospettiva — sono i due punti dove una
regressione passerebbe inosservata.

> **Risolto.** `vitest` nel workspace `server`, 26 test in `server/tests/`
> (`queryBuilder.test.ts` e `parsers.test.ts`), nessun mock e nessuna rete. I due
> parser sono stati esportati per renderli testabili. I test stanno **fuori** da
> `src/` perché `tsconfig.json` compila tutto `src/**` dentro `dist/`; li
> typechecka `tests/tsconfig.json`, agganciato allo script (`tsc -p tests &&
> vitest run`) perché vitest da solo non verifica i tipi. Si lanciano con
> `npm test` dalla root.

---

## 6. Errori di parsing incomprensibili per chi usa l'app

Quando Claude risponde con qualcosa che non è il JSON atteso, `JSON.parse` lancia e il
messaggio che arriva in UI è `Unexpected token < in JSON at position 0`. L'utente non
ha modo di capire se il job è andato in timeout, se ha risposto in prosa o se è un bug.

**Fix economico.** Nei due `catch`, includere i primi ~200 caratteri dell'output
grezzo nel messaggio d'errore. `coworkRunner.ts` lo fa già per gli errori di
sottoprocesso (`stdout.slice(-500)`) — basta estendere lo stesso trattamento ai parser.

**Costo:** 4 righe. **Valore:** medio, si ripaga al primo job che fallisce.

---

## 7. I job lunghi non danno segno di vita

L'estrazione categorie ha un timeout di 120s, la ricerca web di 180s
(`coworkRunner.ts:36`, `searchEngines/web.ts:31`). Per tutto quel tempo la richiesta
HTTP resta aperta e l'utente vede solo uno stato di caricamento, senza sapere se
mancano 3 secondi o 3 minuti.

**Fix economico (quello che consiglio).** Scrivere l'attesa attesa nell'interfaccia:
"la ricerca web può richiedere fino a 3 minuti". Onesto, immediato, zero complessità.

**Fix corretto ma costoso** — job asincrono con id, endpoint di stato e polling dal
client. È la soluzione giusta se un domani i job si moltiplicano, ma oggi è
sovradimensionata: vedi sotto.

**Costo:** 5 minuti per la versione economica. **Valore:** medio.

---

## 8. `--dangerously-skip-permissions`, una scelta da rendere esplicita

`coworkRunner.ts:42` lancia `claude` con `--dangerously-skip-permissions`. Per un'app
locale mono-utente è difendibile — senza, ogni job si bloccherebbe su un prompt
interattivo che nessuno vede. Ma il sottoprocesso gira **senza restrizioni** nella
cartella del job, e i job includono web search: l'input che arriva su stdin contiene
testo che l'utente ha scritto, ma anche, indirettamente, contenuto di pagine web.

**Fix economico.** Sostituire lo skip totale con `--allowedTools` mirato sugli
strumenti che ogni job usa davvero (WebSearch e WebFetch per `web-search`, nessuno
strumento per `extract-categories`, che deve solo ragionare sul testo). Stesso effetto
pratico — niente prompt interattivi — con una superficie molto più stretta.

Se preferisci non toccarlo, allora vale almeno un commento che dica *perché* è
accettabile qui: la scelta è ragionata, ma il codice non lo dice.

**Costo:** ~10 righe. **Valore:** medio.

---

## 9. Scritture concorrenti su JSONL (rischio basso, fix breve)

`JsonlStore.update` e `delete` fanno read-modify-write dell'intero file senza lock
(`research/storage.ts:97-113`). Due richieste simultanee — due tab aperte, o un
doppio click — possono far perdere una scrittura.

Il commento nel codice dichiara il limite ("adatto a un'app locale mono-utente") e la
dichiarazione è corretta, quindi non è un bug nascosto. Ma il rimedio è breve:
serializzare le operazioni per file con una promise-chain (~12 righe), il che elimina
la classe di problema senza introdurre dipendenze né file di lock.

**Costo:** ~12 righe. **Valore:** basso-medio. Da fare solo se ti capita davvero.

---

## Cosa NON farei ora

Non perché siano cattive idee, ma perché il costo supera il beneficio allo stadio
attuale:

| Intervento | Perché rimandarlo |
|---|---|
| **Migrazione a SQLite** | JSONL è leggibile, diffabile e ispezionabile con un editor — proprietà coerenti con gli obiettivi del progetto. Il costo si giustifica solo oltre le ~10k righe. |
| **Job asincroni con coda e polling** | Vera soluzione al punto 7, ma introduce stato dei job, persistenza e UI di avanzamento. Ha senso quando i job diventano molti o concorrenti, non con uno alla volta. |
| **Cache delle risposte dei motori** | Utile se ripeti spesso le stesse query. Oggi non è il collo di bottiglia. |
| **Autenticazione** | L'assenza è una scelta di design dichiarata, non una dimenticanza. Aggiungerla contraddirebbe gli obiettivi. |
| **CI su GitHub Actions** | Ha senso *dopo* che esistono dei test (punto 5), non prima. |
| **Astrarre le sezioni in un sistema a plugin** | Con due sezioni è astrazione prematura. Se ne servono tre o quattro, il discorso cambia. |

---

## Se dovessi fare solo tre cose ✅ fatte il 27/08/2026

1. **Il fix dei duplicati** (punto 1) — è l'unico che produce dati sbagliati.
2. **Togliere le note da git** (punto 2) — due comandi, ed è privacy.
3. **Allineare la UI sull'API key** (punto 3) — tre righe, e sblocca il prossimo che
   apre il progetto.

Insieme: meno di un'ora.

Tutti e tre applicati, più il punto **5** (test con vitest).
Restano aperti i punti **4, 6, 7, 8, 9**.
