# data/

Cartella radice dei file locali gestiti dalla webapp.

- `notes/` — contenuti in formato **Markdown** (`.md`)
- `json/` — dati strutturati in formato **JSON** (`.json`)

Il server legge questa cartella tramite la variabile `DATA_DIR` (vedi `server/.env`).
Nessun dato è sincronizzato sul cloud: tutto resta su questo computer.
