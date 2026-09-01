import fs from 'fs/promises';
import path from 'path';

// Radice dei dati locali. DATA_DIR è relativo alla cartella server/ (vedi .env).
const DATA_ROOT = path.resolve(
  __dirname,
  '../../',
  process.env.DATA_DIR || '../data'
);
const RESEARCH_DIR = path.join(DATA_ROOT, 'research');
const NOTES_DIR = path.join(DATA_ROOT, 'notes');
const DOCUMENTS_DIR = path.join(DATA_ROOT, 'documents');
const YOUTUBE_DIR = path.join(DATA_ROOT, 'youtube');

// I report NON stanno sotto DATA_ROOT: pagina di consultazione e sintesi JSON
// sono contenuto del repository, perché un git clone su un'altra macchina deve
// portarseli dietro. Sotto data/ restano solo i transcript, che si riscaricano.
// Il percorso risale a partire da questo file (server/src/research o
// server/dist/research, stessa profondità in entrambi i casi).
const REPORTS_ROOT = path.resolve(__dirname, '../../../reports');

// Radice effettiva dei dati, per poterla stampare all'avvio: due istanze avviate
// con DATA_DIR diverse sono indistinguibili da fuori finché non lo dicono.
export function dataDir(): string {
  return DATA_ROOT;
}

export function researchPath(...segments: string[]): string {
  return path.join(RESEARCH_DIR, ...segments);
}

export function notesPath(...segments: string[]): string {
  return path.join(NOTES_DIR, ...segments);
}

export function documentsPath(...segments: string[]): string {
  return path.join(DOCUMENTS_DIR, ...segments);
}

export function youtubePath(...segments: string[]): string {
  return path.join(YOUTUBE_DIR, ...segments);
}

// Radice dei report versionati (reports/ nel repository), da tenere distinta da
// dataDir(): la prima si clona, la seconda si ricostruisce.
export function reportsPath(...segments: string[]): string {
  return path.join(REPORTS_ROOT, ...segments);
}

// Scrive un file di testo creando le cartelle mancanti.
export async function writeTextFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

// Scrive un file binario creando le cartelle mancanti.
export async function writeBinaryFile(
  filePath: string,
  content: Buffer
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

// Store append-only su file JSONL (una riga = un record JSON), con
// read-modify-write per update/delete. Adatto a un'app locale mono-utente.
export class JsonlStore<T extends { id: string }> {
  // `resolveDir` decide sotto quale cartella di data/ vive il file: di default
  // research/, ma la sezione YouTube passa youtubePath.
  constructor(
    private readonly fileName: string,
    private readonly resolveDir: (...segments: string[]) => string = researchPath
  ) {}

  private get filePath(): string {
    return this.resolveDir(this.fileName);
  }

  async readAll(): Promise<T[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return raw
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as T);
    } catch (err: any) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async findById(id: string): Promise<T | undefined> {
    const all = await this.readAll();
    return all.find((r) => r.id === id);
  }

  async append(record: T): Promise<T> {
    await ensureDir(this.filePath);
    await fs.appendFile(this.filePath, JSON.stringify(record) + '\n', 'utf8');
    return record;
  }

  async appendMany(records: T[]): Promise<T[]> {
    if (records.length === 0) return [];
    await ensureDir(this.filePath);
    const payload = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    await fs.appendFile(this.filePath, payload, 'utf8');
    return records;
  }

  private async rewrite(records: T[]): Promise<void> {
    await ensureDir(this.filePath);
    const payload =
      records.map((r) => JSON.stringify(r)).join('\n') +
      (records.length ? '\n' : '');
    await fs.writeFile(this.filePath, payload, 'utf8');
  }

  async update(id: string, patch: Partial<T>): Promise<T | undefined> {
    const all = await this.readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    const updated = { ...all[idx], ...patch, id } as T;
    all[idx] = updated;
    await this.rewrite(all);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const all = await this.readAll();
    const next = all.filter((r) => r.id !== id);
    if (next.length === all.length) return false;
    await this.rewrite(next);
    return true;
  }
}
