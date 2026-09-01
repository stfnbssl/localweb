// CRITICO: loadEnv DEVE essere il primo import — gli altri moduli leggono process.env
// al loro module-load time, quindi dotenv.config() deve girare prima di tutti.
import './loadEnv';
import express from 'express';
import cors from 'cors';
import researchRoutes from './routes/research';
import youtubeRoutes from './routes/youtube';
import reportsRoutes from './routes/reports';
import { dataDir } from './research/storage';

const app = express();
const PORT = Number(process.env.PORT) || 4317;
const STARTED_AT = new Date();

// CORS — di default consente solo il client Vite locale.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5180')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
console.log(`[CORS] origini consentite: ${allowedOrigins.join(', ')}`);

app.use(
  cors({
    origin: (origin, cb) => {
      // Richieste senza Origin (es. curl, stessa origine) sono sempre permesse.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} non consentita da CORS`));
    },
  })
);

app.use(express.json({ limit: '10mb' }));

// Health check — non richiede alcuna autenticazione.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - STARTED_AT.getTime()) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// PING — endpoint usato dalla landing page per verificare la connessione al server.
app.get('/api/ping', (_req, res) => {
  res.json({
    pong: true,
    message: 'pong',
    server: 'localweb-server',
    timestamp: new Date().toISOString(),
  });
});

// Research System — flusso Tema → Categorie → Query → Ricerca → Risultati.
// L'estrazione categorie avviene via spawn di Cowork (CLI `claude`), che usa
// l'autenticazione di Claude Code: non serve ANTHROPIC_API_KEY.
app.use('/api/research', researchRoutes);

// YouTube — scarico transcript di un video da URL/ID.
app.use('/api/youtube', youtubeRoutes);

// Reports — un visualizzatore HTML autonomo (reports/viewer/) più un corpus per
// canale (reports/youtube/<canale>/synthesis.json), entrambi versionati nel
// repository. Il server li elenca e li affianca; non li genera e non ne conosce
// il contenuto.
app.use('/api/reports', reportsRoutes);

const server = app.listen(PORT, () => {
  console.log(`localweb-server in ascolto su http://localhost:${PORT}`);
  // Quale archivio sta usando questa istanza: senza dirlo, due server avviati
  // con DATA_DIR diverse sembrano identici da fuori.
  console.log(`[DATI] ${dataDir()}`);
});

// Senza questo handler un EADDRINUSE diventa un'eccezione non gestita: nodemon
// stampa uno stack trace, scrive "app crashed" e va avanti. Il guaio è che il
// server GIÀ attivo continua a rispondere sulla porta, quindi chi ha lanciato il
// secondo processo crede di parlare col proprio e sta invece usando l'altro —
// con l'altro archivio. È successo davvero, ed è costato dati cancellati.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') throw err;

  console.error(
    [
      '',
      `AVVIO INTERROTTO — la porta ${PORT} è già occupata.`,
      '',
      "C'è un altro processo in ascolto: probabilmente un'istanza di",
      'localweb-server già avviata. Questo secondo processo NON è partito, ma il',
      `primo continua a rispondere su http://localhost:${PORT}: attenzione, le`,
      "richieste che farai finiranno lì, sull'archivio di QUELLA istanza.",
      '',
      'Cosa fare:',
      `  · usa il server già attivo, oppure`,
      '  · chiudilo, oppure',
      `  · avvia questo su un'altra porta:  PORT=4318 npm run dev:server`,
      '',
      'Per scoprire quale processo occupa la porta:',
      `  Windows:      netstat -ano | findstr :${PORT}`,
      `  macOS/Linux:  lsof -i :${PORT}`,
      '',
    ].join('\n')
  );
  process.exit(1);
});
