import { spawn } from 'child_process';
import path from 'path';

// Radice delle cartelle-job di Cowork. Risolta come DATA_DIR (rispetto a server/).
const JOBS_ROOT = path.resolve(
  __dirname,
  '../../',
  process.env.COWORK_JOBS_DIR || '../cowork_jobs'
);

export function jobDir(jobName: string): string {
  return path.join(JOBS_ROOT, jobName);
}

export interface RunCoworkJobOptions {
  jobName: string; // sottocartella di cowork_jobs (contiene il CLAUDE.md)
  input: string; // testo passato su stdin (l'input del job)
  timeoutMs?: number;
}

// Envelope restituito da `claude --print --output-format json`.
interface ClaudeResultEnvelope {
  type: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
}

/**
 * Spawna Cowork (la CLI di Claude Code) nella cartella del job. Claude legge
 * automaticamente il CLAUDE.md della cwd; l'input specifico arriva su stdin.
 * Ritorna il testo finale del modello (campo `result` dell'envelope).
 */
export function runCoworkJob(opts: RunCoworkJobOptions): Promise<string> {
  const { jobName, input, timeoutMs = 120_000 } = opts;
  const cwd = jobDir(jobName);

  return new Promise<string>((resolve, reject) => {
    const command = 'claude';
    const params = [
      '--print',
      '--dangerously-skip-permissions',
      '--output-format',
      'json',
    ];

    // Windows: shell:true + comando concatenato per risolvere claude.cmd/.exe
    // in PATH (con params in array si avrebbe DEP0190). POSIX: shell:false.
    const isWin = process.platform === 'win32';
    const child = isWin
      ? spawn(`${command} ${params.join(' ')}`, [], {
          shell: true,
          cwd,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      : spawn(command, params, {
          cwd,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (c: Buffer) => (stdout += c.toString()));
    child.stderr?.on('data', (c: Buffer) => (stderr += c.toString()));

    const timer = setTimeout(() => {
      killChild();
      reject(new Error(`Cowork timeout dopo ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    function killChild() {
      if (child.pid && !child.killed) {
        try {
          process.kill(child.pid, 'SIGTERM');
          const pid = child.pid;
          setTimeout(() => {
            try {
              if (!child.killed) process.kill(pid, 'SIGKILL');
            } catch {
              /* già terminato */
            }
          }, 3000);
        } catch {
          /* già terminato */
        }
      }
    }

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Impossibile avviare Cowork (claude): ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(
          new Error(`Cowork terminato con exit ${code}. ${stderr.slice(-500)}`)
        );
      }
      try {
        const envelope = JSON.parse(stdout) as ClaudeResultEnvelope;
        if (envelope.is_error || typeof envelope.result !== 'string') {
          return reject(new Error(`Cowork ha riportato un errore: ${stdout.slice(-500)}`));
        }
        resolve(envelope.result);
      } catch {
        reject(new Error(`Output di Cowork non parsabile come JSON: ${stdout.slice(-500)}`));
      }
    });

    child.stdin?.write(input);
    child.stdin?.end();
  });
}
