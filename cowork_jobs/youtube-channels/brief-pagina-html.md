# Brief per Claude Code — pagina di navigazione HTML (tre corpus)

**Da produrre:** un unico file `index.html`, scritto **tre volte, identico**, in:
- `C:\my\projects\localweb\data\youtube\UC39jphb_m0Cv6MHHWGyP8iQ\sintesi\`
- `C:\my\projects\localweb\data\youtube\UCXOtILmQEo3pL_1bJfUOFWw\sintesi\`
- `C:\my\projects\localweb\data\youtube\UCxEQsjgRRfGWiJJu_PDygxw\sintesi\`

Stesso file, non tre varianti: la pagina si adatta ai dati che trova.

**Input, uno per cartella:**
- `statrys-china-analysis-synthesis.json` (42 record, 344 osservazioni, 13 temi)
- `chinatalk-analysis-synthesis.json` (50 record, 460 osservazioni, 15 temi, 45 ospiti)
- `cyrus-janssen-analysis-synthesis.json` (48 record, 501 osservazioni, 14 temi, 22 ospiti)

**Contratto dei dati:** `schema-v2.json` (v2.1), presente in tutte e tre le cartelle e identico. Leggilo prima di scrivere codice: contiene le trappole strutturali, e almeno quattro fanno sbagliare chi non le legge. Tutti e tre i JSON validano contro di esso senza errori.

---

## 1. Cosa deve fare la pagina

Rendere navigabile una sintesi critica di transcript YouTube: temi trasversali, schede per singolo contenuto, valutazione della fonte.

Il punto non è mostrare dei contenuti. Il punto è che **ogni affermazione arrivi al lettore già accompagnata dal suo giudizio critico**. Una pagina che presenti gli insight come fatti neutri sarebbe peggio di nessuna pagina: renderebbe più autorevole del dovuto materiale che l'analisi ha già qualificato.

Tradotto in vincolo di progetto: **`reliability`, `note`/`reliability_note` e `claim_type` non sono metadati opzionali, sono parte del contenuto.** Non nasconderli dietro hover, tooltip, accordion chiusi o icone senza etichetta.

**I tre corpus sono di generi diversi e la pagina non deve appiattirli.**

| | Statrys | ChinaTalk | Cyrus Janssen |
|---|---|---|---|
| genere | canale marketing monologante | podcast di interviste lunghe | commentario geopolitico + vlog Cina |
| `plausible_unverified` | 43% | 82% | 44% |
| gonfiato o errato | 96 su 344 (28%) | 44 su 460 (10%) | **208 su 501 (42%)** |
| `claim_type` | assente | presente | presente |
| ospiti nominati | nessuno | 45 | 22 |
| `credibility_note` | assente | assente | 17 ospiti su 22 |
| record senza disaccordo | n/d | n/d | **24 su 48** |

Le stesse etichette significano cose diverse nei tre file: in un canale marketing `plausible_unverified` segnala un'affermazione non sostanziata, in un archivio di interviste segnala il giudizio professionale di un esperto nel proprio campo, e nel terzo corpus la competenza varia enormemente da un ospite all'altro. **Le definizioni vanno lette da `reliability_scale` nel file, non riscritte nel codice**, proprio perché sono calibrate diversamente. E per la stessa ragione: mai mettere le distribuzioni di due corpus a confronto diretto in un grafico.

---

## 2. Il contratto dei dati, e le trappole

Leggi `schema-v2.json` per intero. Riassunto dei punti che contano per la UI:

**Due livelli paralleli, collegati solo da `video_id`:**
- `themes[]` — sintesi trasversale scritta a mano: `key_insights[]`, `watch_outs[]`, `video_ids[]`.
- `videos[]` — schede per singolo transcript, estratte automaticamente: `key_observations[]`, `figures_cited[]`, e nel corpus ChinaTalk anche `guests[]` e `contested_points[]`.

**Trappola 1 — `videos[].primary_theme` non è una chiave verso `themes[].theme_id`.** Vocabolari indipendenti: 41 valori distinti su 42 video nel corpus Statrys. Se raggruppi i video per quel campo ottieni gruppi da un elemento e la pagina è inutile. **L'unica relazione tema→video valida è `themes[].video_ids[]`**, molti-a-molti (22 record su 50 in ChinaTalk e 37 su 48 in Cyrus Janssen stanno in più di un tema, fino a cinque). `primary_theme` e `secondary_themes` si mostrano come tag descrittivi sulla scheda, nient'altro.

**Trappola 2 — i `video_id` possono iniziare con `-` o `_`.** Reali nei tre file: `-po2y1lRN8E`, `-LTuMupV310`, `_FUv6Eb7FuM`, `_aYcb2X7S1A`, `-kP-kkjzO6E`, `-uXyi4ft8U4`, `-idI5zKO1M8`, `_HL8HkDxfLM`. Un `document.querySelector('#' + id)` con quegli ID lancia un errore di selettore. Usa `CSS.escape()`, `getElementById`, o prefissa gli ID nel DOM (`id="v-${video_id}"`). Vale anche per l'hash routing: prefissa sempre.

**Trappola 3 — `figures_cited[].value` sono stringhe, non numeri.** I corpus mescolano valute, unità e ordini di grandezza, e in più casi documentati l'unità è sbagliata. Non parsarle, non sommarle, non farci grafici: solo testo, in tabella.

**Trappola 4 — le clip non sono episodi.** 21 record su 50 in ChinaTalk e 7 su 48 in Cyrus Janssen hanno `content_type: "clip"`: sono estratti di 30-90 secondi con 1-3 osservazioni per costruzione. Mescolarli agli episodi nelle statistiche falsa tutto. Marcali visivamente e offri un interruttore per escluderli; `meta.episodes` e `meta.clips` danno i conteggi corretti.

**Trappola 5 — un `contested_points` vuoto è un dato, non un campo mancante.** Significa che in un'ora nessuno ha contraddetto nessuno, che in questi corpus è un segnale di consenso della stanza segnalato esplicitamente nell'analisi. Nel corpus Cyrus Janssen è metà dei record e `meta.records_with_no_disagreement` lo conta. Non nascondere la sezione quando è vuota: scrivi che non c'è stato disaccordo.

**Trappola 6 — `guests[].credibility_note` non è come gli altri campi: contiene conoscenza esterna ai transcript.** Track record pubblico di previsioni, affiliazioni statali, assenza di credenziali dichiarate — oppure, al contrario, credenziali accademiche reali nel campo esatto discusso. Ogni valore inizia con la stringa `External to the transcript:`. **Va mostrato marcato visivamente come valutazione esterna e tenuto distinto da `expertise_basis`**, che riporta invece ciò che l'episodio stesso dichiara. Confonderli attribuirebbe all'episodio un giudizio che non contiene. Non è un campo negativo per default: dove l'ospite è uno specialista credenziato nel campo trattato, il campo lo dice, e il lettore ne ha bisogno esattamente quanto dell'avvertenza opposta.

**Campi nullable da gestire:** `supporting_data`, `attributed_source` (assente nell'85% delle cifre Statrys), `commercial_angle` (null in 1 record su 42 Statrys, 20 su 50 ChinaTalk), `format_note`, `guests[].affiliation` (null in 15 casi su 75 — e l'assenza è essa stessa un dato, perché impedisce di valutare gli interessi in gioco). Nessun "null" o "undefined" a schermo.

**Campi opzionali che decidono cosa mostrare.** `claim_type`, `claim_type_scale`, `guest_index`, `contested_points`, `hosts`, `guests`, `attributed_to`, `meta.claim_type_distribution`: presenti in ChinaTalk e Cyrus Janssen, assenti in Statrys. `credibility_note` e `meta.records_with_no_disagreement`: presenti solo in Cyrus Janssen. **La pagina deve rilevarli e adattarsi**, non fallire e non mostrare sezioni vuote. Regola: se `claim_type_scale` manca, niente filtro tipo-di-affermazione; se `guest_index` manca, niente vista ospiti; se nessun ospite ha `credibility_note`, niente blocco valutazione esterna.

**Già ordinati nel file:** `themes` per `rank` crescente, `videos` per `published_at` crescente, `guest_index` per apparizioni decrescenti. Non riordinare per default.

---

## 3. Architettura dell'informazione

Navigazione **theme-first**. Tre livelli più le viste trasversali.

```
Home / indice temi
 └── Tema (13, 14 o 15)
      ├── key_insights → ogni insight linka ai suoi video
      ├── watch_outs
      └── video_ids → Scheda record
Scheda record (42, 48 o 50)
 └── thesis, key_observations, figures_cited, commercial_angle
     + guests, contested_points        (dove presenti)

Viste trasversali, raggiungibili da qualunque punto:
 ├── Fonte         (source_assessment + meta.analyst_note)
 ├── Da verificare (verify_before_using — 10-12 voci)
 ├── Errori noti   (known_errors_and_distortions — 20-36 voci)
 └── Ospiti        (guest_index — dove presente)
```

**Home.** In testa, prima di qualunque contenuto: il blocco fonte in forma compatta — cosa è il canale, quale interesse ha — e `meta.analyst_note` per esteso. Poi la distribuzione di affidabilità (`meta.reliability_distribution`) come barra unica a quattro segmenti proporzionali con i conteggi assoluti leggibili, e **dove presente** la distribuzione per `claim_type` accanto. Nel corpus ChinaTalk quest'ultima è la statistica più informativa delle due — 59% interpretazione, 19% empirico, 9% previsione — e va data pari dignità. Poi l'indice dei temi in ordine di `rank`: label, `why_it_matters`, numero di insight, numero di record, micro-barra della composizione di affidabilità.

**Pagina tema.** `description`, `why_it_matters`, poi gli `key_insights` come card. Ogni card: il testo dell'insight in evidenza, sotto la `note` in un blocco visivamente subordinato ma **sempre visibile**, i chip dei video di provenienza, e i badge di `reliability` e (dove presente) `claim_type`. In coda: `watch_outs` in un blocco distinto e marcato come avvertenza, e la griglia dei record del tema.

**Scheda record.** Titolo originale (non ripulirlo: maiuscole ed emoji sono un dato, e in tutti e tre i corpus ci sono titoli contraddetti dal proprio contenuto), data, `content_type`, `format_note`, link a YouTube costruito come `https://www.youtube.com/watch?v={video_id}`, nome del file `.md` di origine. Poi `hosts` e `guests` dove presenti — per ogni ospite nome, affiliazione, `expertise_basis` (ciò che dichiara l'episodio) e, in un blocco visivamente distinto, `credibility_note` (valutazione esterna ai transcript). Poi `thesis`, `why_it_matters`, `commercial_angle` in un blocco separato e riconoscibile. Poi `key_observations` come lista: osservazione, `attributed_to` in evidenza dove presente, badge `claim_type`, `supporting_data` se c'è, `reliability_note` sempre visibile. Poi `contested_points`. Infine `figures_cited` in tabella a tre colonne, con la colonna fonte che distingue visivamente "fonte citata" da "nessuna fonte".

Una scheda mostra anche **a quali temi appartiene**, calcolato invertendo `themes[].video_ids` all'avvio.

**Vista ospiti** (ChinaTalk e Cyrus Janssen): l'elenco da `guest_index`, ordinato per apparizioni, ciascuno con affiliazione, `expertise_basis`, `credibility_note` dove presente, e link agli episodi. È la seconda porta di navigazione naturale in un archivio di interviste, e nel corpus Cyrus Janssen è la vista più importante della pagina: la qualità degli ospiti varia da uno specialista accademico nel campo esatto discusso a un commentatore senza credenziali, e la scheda dell'ospite è dove quella differenza è visibile. I nomi vengono da transcript automatici e alcuni sono storpiati o parziali: mostrali come sono, senza normalizzare.

---

## 4. Interazione

**Filtro affidabilità.** Persistente, visibile in ogni vista, quattro toggle indipendenti (non un menu a scelta singola). Filtra insight e osservazioni insieme. Quando un filtro svuota un tema, il tema resta nell'indice segnalato come vuoto sotto il filtro corrente — non farlo sparire, altrimenti il lettore non capisce cosa ha escluso.

**Filtro tipo-di-affermazione**, solo dove `claim_type_scale` è presente. Cinque toggle. È il filtro più utile su ChinaTalk: isolare le `forecast` mostra in un colpo quanto del corpus è previsione.

**Filtro clip/episodi**, dove esistono clip.

**Filtro "solo record con disaccordo"**, dove `contested_points` esiste. Nel corpus Cyrus Janssen dimezza l'archivio e isola i 24 record in cui qualcuno ha contraddetto qualcun altro — che l'analisi indica come i più informativi.

Genera legende e tooltip da `reliability_scale` e `claim_type_scale` nel file, non riscrivendo le definizioni a mano.

**Ricerca full-text.** Un campo, su: label/description/why_it_matters dei temi, testo di insight e note, title/thesis dei record, testo di osservazioni e note, `contested_points`, nomi degli ospiti, `known_errors_and_distortions[].error`, `verify_before_using[].claim`. Risultati raggruppati per tipo, con evidenziazione del termine. Debounce ~150 ms. Indice costruito una volta all'avvio.

**Routing via hash**, così ogni vista è linkabile e il tasto indietro funziona:
`#/`, `#/theme/<theme_id>`, `#/video/<video_id>`, `#/source`, `#/verify`, `#/errors`, `#/guests`, `#/search?q=...`

---

## 5. Impostazione visiva

Sobria, densa, da strumento di consultazione. Non un dashboard con KPI colorati: è un documento critico, e l'estetica deve dire "leggimi", non "guardami".

**Scala di affidabilità** — quattro livelli ordinali, quindi una progressione, non quattro colori arbitrari. Verde/neutro per `verifiable`, ambra per `plausible_unverified`, arancio per `likely_exaggerated`, rosso per `misleading_or_wrong`. Contrasto minimo 4.5:1 sul testo. **Sempre affiancati da etichetta testuale**: circa l'8% degli uomini ha una qualche forma di daltonismo, e questa scala è esattamente sull'asse rosso-verde.

**`credibility_note` va marcata come esterna.** Un bordo, un'icona con etichetta o un'intestazione esplicita — qualcosa che dica al lettore che quel giudizio non viene dall'episodio. Non usare per essa la stessa scala di colori dell'affidabilità: è un asse diverso e non è ordinale.

**`claim_type` non è ordinale** — è una classificazione nominale. Non dargli una scala di colore progressiva: usa forme, bordi o un colore neutro con etichetta. Confonderlo visivamente con l'affidabilità è l'errore più facile da fare qui.

Tipografia: font di sistema, misura di riga 65-75 caratteri sui blocchi di prosa. Contenuti in inglese, interfaccia in italiano.

Tema chiaro e scuro via `prefers-color-scheme`, colori come custom properties su `:root` e ridefinizione solo di quelle nel blocco dark. Responsive: la tabella delle cifre in un contenitore con `overflow-x: auto`, il body non deve mai scrollare orizzontalmente.

---

## 6. Vincoli tecnici

- **Un solo file**, `index.html`. HTML, CSS e JS inline. Nessun build step, nessun framework, nessuna dipendenza esterna, nessuna CDN. Vanilla JS.
- **Nessun `localStorage`/`sessionStorage`** per lo stato: lo stato vive nell'hash dell'URL.
- Il JSON si carica via `fetch`. **Non hardcodare il nome del file**: prova i tre nomi noti (`./statrys-china-analysis-synthesis.json`, `./chinatalk-analysis-synthesis.json`, `./cyrus-janssen-analysis-synthesis.json`) e usa il primo che risponde, così lo stesso file funziona in tutte e tre le cartelle.

**Il problema `file://` va risolto, non ignorato.** Aprendo l'HTML con doppio clic, Chrome blocca la `fetch` sul file locale per policy CORS e la pagina resta bianca. Gestiscilo così:

1. Prova la `fetch`.
2. Se fallisce, **non mostrare un errore tecnico**: mostra un pannello con (a) un `<input type="file" accept=".json">` per caricare il JSON a mano, e (b) l'istruzione per servire la cartella:
   ```
   cd <la cartella sintesi>
   python -m http.server 8000
   ```
   poi `http://localhost:8000/`.

Il percorso con `<input type="file">` deve portare alla pagina pienamente funzionante, non a una versione ridotta.

**Performance:** da 568 KB a 845 KB, fino a ~1.400 record fra osservazioni e cifre. Non serve virtualizzazione né lazy loading. Serve solo non ricostruire l'intero DOM a ogni battuta nel campo di ricerca.

---

## 7. Criteri di accettazione

Verificali **su tutti e tre i corpus** prima di considerare il lavoro finito, servendo ciascuna cartella su `localhost`.

1. `JSON.parse` riesce e i temi compaiono in ordine di `rank` (13 Statrys, 15 ChinaTalk, 14 Cyrus Janssen).
2. Copertura: in ChinaTalk e in Cyrus Janssen tutti i record sono raggiungibili da almeno un tema; in Statrys 41 su 42, e il 42° (`KRQsHuS8uCU`) è raggiungibile da `videos_not_in_any_theme` con la sua motivazione. Nessun record irraggiungibile dalla navigazione.
3. Ogni `video_id` referenziato da un tema, da un insight, da un errore, dalla coda di verifica o dal `guest_index` risolve a una scheda esistente. Nessun link morto. (Verificato: zero riferimenti orfani in tutti e tre i file.)
4. Gli otto ID che iniziano con `-` o `_` sono navigabili: apri `#/video/-po2y1lRN8E` (Statrys), `#/video/-uXyi4ft8U4` (ChinaTalk) e `#/video/_HL8HkDxfLM` (Cyrus Janssen) da URL diretto e verifica che non ci siano errori in console.
5. Nessun "null", "undefined" o cella vuota ambigua a schermo. Controlla in particolare: una scheda con `commercial_angle: null`, la tabella cifre di Statrys dove l'85% delle fonti manca, un ospite con `affiliation: null`, e un ospite senza `credibility_note`.
6. **La stessa pagina funziona su tutti e tre i file.** Su Statrys non mostra il filtro `claim_type` né la vista ospiti; su ChinaTalk mostra entrambi ma nessun blocco di valutazione esterna; su Cyrus Janssen mostra anche le `credibility_note` e il filtro sul disaccordo. Nessun errore in console in nessuno dei tre casi.
7. Il filtro affidabilità agisce su insight e osservazioni insieme; disattivando tutti e quattro i livelli la pagina resta comprensibile invece di apparire rotta.
8. Ogni insight e ogni osservazione mostrano la propria nota critica **senza richiedere un'interazione**.
9. `credibility_note` è visivamente distinta da `expertise_basis` e riconoscibile come valutazione esterna ai transcript. Un lettore che guarda la scheda di un ospite deve capire senza sforzo quale delle due informazioni viene dall'episodio e quale no.
10. Nessun colore veicola informazione da solo: attiva un filtro grayscale nei devtools e verifica che affidabilità, tipo di affermazione e valutazione esterna restino leggibili e distinguibili fra loro.
11. Un episodio con `contested_points: []` dichiara esplicitamente che non c'è stato disaccordo, invece di nascondere la sezione. Il filtro sul disaccordo, dove presente, riduce Cyrus Janssen a 24 record.
12. Le clip sono visivamente distinte dagli episodi e l'interruttore per escluderle funziona (21 clip in ChinaTalk, 7 in Cyrus Janssen).
13. Ricarica su un deep link (`#/theme/...`): la vista corretta si apre. Il tasto indietro torna alla vista precedente.
14. A 375 px di larghezza non c'è scroll orizzontale del body. Modalità chiara e scura entrambe leggibili.

---

## 8. Cosa non fare

- Non riassumere, riscrivere o accorciare i contenuti del JSON. La pagina è un visualizzatore; il lavoro editoriale è già stato fatto e le formulazioni sono deliberate.
- Non trasformare `figures_cited` in grafici. Sono stringhe eterogenee con unità sbagliate documentate: un grafico darebbe una precisione che i dati non hanno.
- **Non mettere le distribuzioni dei corpus a confronto diretto**, né in un grafico né in una tabella. Le etichette sono calibrate su generi diversi, e un confronto suggerirebbe una graduatoria di attendibilità fra canali che i numeri non sostengono nel modo in cui verrebbe letta.
- Non costruire un punteggio sintetico di "affidabilità del canale". La distribuzione è già il dato; un punteggio nasconderebbe la differenza fra un meccanismo valido e la cifra sbagliata che gli è attaccata, che è esattamente la distinzione che questi corpus richiedono.
- **Non trattare `credibility_note` come una condanna.** È un campo a due direzioni: per alcuni ospiti registra credenziali accademiche reali nel campo esatto discusso. Renderlo graficamente come un avviso di pericolo falserebbe metà dei suoi valori.
- Non presentare `source_assessment` come una nota a piè di pagina o un "disclaimer" in fondo. È il contesto che qualifica tutto il resto.
- Non normalizzare i nomi degli ospiti, non completarli e non correggerli. Vengono da transcript automatici, e diversi record segnalano esplicitamente l'incertezza fra parentesi: inventare un'identità plausibile sarebbe peggio di lasciare il nome storpiato.
- Non aggiungere contenuto di tua iniziativa: nessuna conclusione, nessuna raccomandazione, nessun collegamento a fonti esterne oltre ai link YouTube ricostruiti dagli ID.
