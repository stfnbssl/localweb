import { Router } from 'express';
import { listReports, parseReportAsset, reportAssetPath } from '../reports/catalog';

const router = Router();

// --- Elenco dei report disponibili ---
router.get('/', async (_req, res) => {
  try {
    res.json(await listReports());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Lettura dei report fallita' });
  }
});

// --- La pagina del report e il corpus che carica ---
// La pagina fa fetch('./synthesis.json'), quindi le due cose devono arrivare
// dallo stesso percorso URL anche se sul disco stanno in due cartelle diverse:
//   /view/<canale>/index.html     → reports/viewer/index.html      (una per tutti)
//   /view/<canale>/synthesis.json → reports/youtube/<canale>/...   (uno per canale)
// È questo affiancamento a permettere un solo visualizzatore invece di una copia
// per canale.
router.use('/view', (req, res) => {
  const asset = parseReportAsset(req.path);
  if (!asset) {
    res.status(404).json({ error: 'Percorso non esposto' });
    return;
  }
  const file = reportAssetPath(asset);
  if (!file) {
    res.status(404).json({ error: 'Percorso non esposto' });
    return;
  }

  // I report sono file locali che l'autore riscrive: rivalidare sempre evita
  // di guardare la versione precedente dopo una rigenerazione.
  res.sendFile(file, { headers: { 'Cache-Control': 'no-cache' }, dotfiles: 'deny' }, (err: any) => {
    if (!err || res.headersSent) return;
    const missing = err.code === 'ENOENT' || err.status === 404;
    res
      .status(missing ? 404 : 500)
      .json({ error: missing ? 'Report non trovato' : 'Lettura del report fallita' });
  });
});

export default router;
