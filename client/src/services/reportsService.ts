import { API_URL } from '../utils/constants';

// Un report è una pagina HTML autonoma (reports/viewer/index.html, la stessa per
// tutti i canali) che carica il corpus del canale richiesto. Il client la elenca
// e la incornicia: non ne conosce né il contenuto né la struttura interna.
export interface ReportSummary {
  channelId: string;
  channelTitle: string | null;
  title: string; // meta.title del corpus
  path: string; // <channelId>/index.html
  updatedAt: string;
  sizeBytes: number;
}

export async function listReports(): Promise<ReportSummary[]> {
  const response = await fetch(`${API_URL}/reports`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error || `HTTP ${response.status}`);
  }
  return body as ReportSummary[];
}

// L'URL da dare all'iframe. Passa da API_URL perché in sviluppo /api è il proxy
// di Vite verso il server, e VITE_API_URL può spostarlo altrove.
// Sotto lo stesso percorso il server espone anche synthesis.json, che la pagina
// carica da sé con un fetch relativo.
export function reportUrl(report: ReportSummary): string {
  return `${API_URL}/reports/view/${report.path}`;
}
