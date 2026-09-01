import fs from 'fs/promises';
import path from 'path';
import { reportsPath } from '../research/storage';
import { isChannelId } from '../youtube/feed';
import { channels } from '../youtube/store';

// Un "report" è una pagina HTML autonoma che mostra un corpus analizzato.
// Pagina e corpus sono due cose distinte, e stanno in due posti distinti:
//
//   reports/viewer/index.html                 il visualizzatore, UNO per tutti
//   reports/youtube/<channelId>/synthesis.json  il corpus, uno per canale
//
// Entrambi sono contenuto del repository: un git clone su un'altra macchina li
// porta con sé e l'app funziona subito. Sotto data/youtube/ restano solo i
// transcript grezzi, che si riscaricano dal canale e non vanno versionati.
//
// Il server non genera né interpreta la pagina: la serve, e le mette accanto il
// corpus del canale richiesto (vedi routes/reports.ts).
export const VIEWER_DIR = 'viewer';
export const CORPORA_DIR = 'youtube';
export const REPORT_ENTRY = 'index.html';
export const REPORT_DATA = 'synthesis.json';

export interface ReportSummary {
  channelId: string;
  channelTitle: string | null;
  title: string;
  // Percorso relativo alla radice dei report: il client ci antepone
  // API_URL + '/reports/view/', così un VITE_API_URL diverso resta rispettato.
  path: string;
  updatedAt: string;
  sizeBytes: number;
}

export interface ReportAsset {
  channelId: string;
  file: string; // percorso relativo, separatori '/'
}

// Traduce il percorso di una richiesta in <canale, file>, oppure null se non è
// un percorso da servire. È una funzione pura perché è la parte che, sbagliata,
// espone il filesystem: i test la coprono direttamente.
export function parseReportAsset(urlPath: string): ReportAsset | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null; // percentuale malformata: non è un percorso da servire
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;

  const parts = decoded.split('/').filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  if (!isChannelId(parts[0])) return null;
  // '..' e i file nascosti non passano nemmeno in mezzo al percorso.
  if (parts.some((p) => p === '..' || p.startsWith('.'))) return null;

  return { channelId: parts[0], file: parts.slice(1).join('/') };
}

// Il file su disco che risponde a una richiesta. La pagina è una sola e vive
// nel visualizzatore; tutto il resto viene dalla cartella del canale.
// Ritorna null se il percorso uscirebbe dalla cartella prevista: il controllo
// di contenimento è ridondante rispetto a parseReportAsset, ed è voluto.
export function reportAssetPath(asset: ReportAsset): string | null {
  if (asset.file === REPORT_ENTRY) {
    return reportsPath(VIEWER_DIR, REPORT_ENTRY);
  }
  const root = reportsPath(CORPORA_DIR, asset.channelId);
  const target = path.resolve(root, asset.file);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

// Il titolo mostrato nell'elenco viene da meta.title del corpus: è lì che
// l'analista lo ha già scritto, e ora la pagina HTML è la stessa per tutti i
// canali, quindi il suo <title> non distinguerebbe più un report dall'altro.
const META_TITLE_RE = /"meta"\s*:\s*\{[\s\S]*?"title"\s*:\s*"((?:[^"\\]|\\.)*)"/;

export function extractMetaTitle(head: string): string | null {
  const m = META_TITLE_RE.exec(head);
  if (!m) return null;
  let text: string;
  try {
    text = JSON.parse(`"${m[1]}"`);
  } catch {
    return null;
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text.length ? text : null;
}

// Legge solo la testa del file: meta sta in cima e il corpus pesa centinaia di KB.
const HEAD_BYTES = 64 * 1024;

async function readCorpusTitle(filePath: string): Promise<string | null> {
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return extractMetaTitle(buf.subarray(0, bytesRead).toString('utf8'));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  let entries;
  try {
    entries = await fs.readdir(reportsPath(CORPORA_DIR), { withFileTypes: true });
  } catch (err: any) {
    if (err.code === 'ENOENT') return []; // nessun corpus pubblicato: elenco vuoto
    throw err;
  }

  // I titoli dei canali stanno in data/, che dopo un clone è vuota: l'elenco
  // deve reggere la loro assenza, e il titolo del corpus basta da solo.
  const known = new Map(
    (await channels.readAll()).map((c) => [c.id, c.title] as const)
  );

  const found: ReportSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isChannelId(entry.name)) continue;
    const file = reportsPath(CORPORA_DIR, entry.name, REPORT_DATA);
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      continue; // cartella senza corpus: normale
    }
    if (!stat.isFile()) continue;

    const channelTitle = known.get(entry.name) ?? null;
    found.push({
      channelId: entry.name,
      channelTitle,
      title: (await readCorpusTitle(file)) ?? channelTitle ?? entry.name,
      path: `${entry.name}/${REPORT_ENTRY}`,
      // Data e peso sono quelli del corpus: è il file che cambia quando
      // l'analisi viene rifatta.
      updatedAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
    });
  }

  found.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return found;
}
