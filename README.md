# localweb

Webapp **locale** (gira solo su questo computer): nessun controllo accessi, nessun
database cloud. Gestisce file locali in formato **Markdown** e **JSON** ed esegue
lavori tramite *spawn* su **Claude Cowork** e **Claude Code**.

📖 **[docs/README.md](docs/README.md)** — obiettivi del progetto e cosa fanno le
singole sezioni (Research System, YouTube Transcript).

## Struttura

```
localweb/
├── server/   Express + TypeScript (API locale, porta 4317)
├── client/   React + Vite + TypeScript + Tailwind (porta 5180)
└── data/     File locali — notes/ (Markdown) e json/ (JSON)
```

Stack e convenzioni allineati al progetto `hcaire`.

## Avvio

```bash
npm install        # installa tutti i workspace
npm run dev        # avvia server (4317) e client (5180) insieme
```

Poi apri http://localhost:5180 — la landing page esegue un **PING** all'endpoint
`/api/ping` del server e mostra lo stato della connessione.

### Comandi utili

| Comando              | Descrizione                            |
| -------------------- | -------------------------------------- |
| `npm run dev`        | server + client in parallelo           |
| `npm run dev:server` | solo il server (nodemon)               |
| `npm run dev:client` | solo il client (Vite)                  |
| `npm run build`      | build di produzione di server e client |

## Configurazione

Copia `server/.env.example` in `server/.env` per personalizzare porta, CORS e
cartella dati (`DATA_DIR`). I file `.env` non vengono versionati.
