// CRITICO: loadEnv DEVE essere il primo import — gli altri moduli leggono process.env
// al loro module-load time, quindi dotenv.config() deve girare prima di tutti.
import './loadEnv';
import express from 'express';
import cors from 'cors';
import researchRoutes from './routes/research';

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

app.listen(PORT, () => {
  console.log(`localweb-server in ascolto su http://localhost:${PORT}`);
});
