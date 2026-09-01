// Elenco dei video di un canale via feed RSS pubblico di YouTube.
//
// Perché RSS e non la Data API v3: il feed non richiede API key né quota, e per
// un'app locale è un pezzo in meno da configurare. Il prezzo è un tetto fisso:
// **gli ultimi 15 video**, senza paginazione. Per andare più indietro nella
// cronologia di un canale servirebbe la Data API (channels.list → playlist
// "uploads" → playlistItems.list).

export interface ChannelInfo {
  channelId: string;
  channelTitle: string | null;
}

export interface FeedVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  url: string;
}

// Quanti video espone il feed Atom di un canale: è un limite di YouTube, non una
// scelta dell'app, e non è paginabile.
export const RSS_FEED_LIMIT = 15;

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export function isChannelId(value: string): boolean {
  return CHANNEL_ID_RE.test(value);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&'); // per ultimo: altrimenti riespande le entità già decodificate
}

function tagText(xml: string, tag: string): string | null {
  // I backslash vanno raddoppiati: in un template literal `[\s\S]` si
  // ridurrebbe a `[sS]`, che matcha le lettere s e S invece di "qualsiasi
  // carattere".
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1].trim()) : null;
}

/**
 * Estrae i video dal feed Atom di un canale.
 *
 * Si lavora per `<entry>` e non con regex globali sul documento: a livello di
 * feed esistono un `<title>` e un `<published>` che appartengono al *canale*,
 * e pescarli insieme a quelli delle entry sfasa di uno tutti gli abbinamenti.
 */
export function parseChannelFeed(xml: string): FeedVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: FeedVideo[] = [];
  for (const entry of entries) {
    const videoId = tagText(entry, 'yt:videoId');
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
    videos.push({
      videoId,
      title: tagText(entry, 'title') ?? '(senza titolo)',
      publishedAt: tagText(entry, 'published') ?? '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return videos;
}

// Titolo del canale: sta nel `<title>` di primo livello, prima della prima entry.
export function parseChannelTitle(xml: string): string | null {
  const head = xml.split('<entry>')[0];
  return tagText(head, 'title');
}

/**
 * Ricava il channelId (`UC…`) da ciò che l'utente incolla: l'id nudo, un URL
 * /channel/UC…, oppure un handle (@nome) o un URL /@nome, /c/…, /user/….
 *
 * Per gli handle non esiste un endpoint pubblico senza API key: si scarica la
 * pagina del canale e si cerca il channelId nell'HTML. Funziona, ma dipende dal
 * markup di YouTube — se un domani smette, l'alternativa è la Data API
 * (`channels.list?forHandle=`) oppure incollare direttamente l'URL /channel/.
 */
export async function resolveChannelId(input: string): Promise<string> {
  const raw = input.trim();
  if (!raw) throw new Error('Canale non specificato');
  if (isChannelId(raw)) return raw;

  const direct = raw.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
  if (direct) return direct[1];

  const pageUrl = raw.startsWith('http')
    ? raw
    : `https://www.youtube.com/${raw.startsWith('@') ? raw : '@' + raw}`;

  let html: string;
  try {
    const res = await fetch(pageUrl, { headers: { 'accept-language': 'en' } });
    if (!res.ok) {
      throw new Error(`la pagina del canale ha risposto HTTP ${res.status}`);
    }
    html = await res.text();
  } catch (err: any) {
    throw new Error(`Canale non raggiungibile: ${err?.message ?? 'errore di rete'}`);
  }

  const found = parseChannelIdFromHtml(html);
  if (!found) {
    throw new Error(
      'Impossibile ricavare il channelId da questo indirizzo: prova con l\'URL nella forma /channel/UC…'
    );
  }
  return found;
}

/**
 * Pesca il channelId dall'HTML della pagina di un canale.
 *
 * L'ordine dei tentativi non è indifferente. Il primo `"channelId"` che compare
 * nel markup appartiene tipicamente a un canale *suggerito*, non a quello
 * richiesto: verificato su @Fireship, @veritasium e @mkbhd, tutti e tre
 * risolvevano al canale sbagliato. Il `<link rel="canonical">` e il meta
 * `channel_id` puntano invece al canale della pagina, e vanno provati per primi.
 */
export function parseChannelIdFromHtml(html: string): string | null {
  const patterns = [
    /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/,
    /channel_id=(UC[A-Za-z0-9_-]{22})/,
    /"externalId":"(UC[A-Za-z0-9_-]{22})"/,
    // Ultima spiaggia, con la riserva di cui sopra.
    /"channelId":"(UC[A-Za-z0-9_-]{22})"/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

// Scarica e interpreta il feed del canale.
export async function fetchChannelFeed(
  channelId: string
): Promise<{ channel: ChannelInfo; videos: FeedVideo[] }> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url);
  if (res.status === 404) {
    throw new Error(`Nessun feed per il canale ${channelId}`);
  }
  if (!res.ok) {
    throw new Error(`Il feed del canale ha risposto HTTP ${res.status}`);
  }
  const xml = await res.text();
  return {
    channel: { channelId, channelTitle: parseChannelTitle(xml) },
    videos: parseChannelFeed(xml),
  };
}
