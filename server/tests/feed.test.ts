import { describe, it, expect } from 'vitest';
import {
  parseChannelFeed,
  parseChannelTitle,
  parseChannelIdFromHtml,
  isChannelId,
} from '../src/youtube/feed';

// Frammento fedele al feed reale di YouTube: quello che conta è che a livello di
// <feed> esistano un <title> e un <published> APPARTENENTI AL CANALE, prima
// della prima <entry>. Sono la trappola che questo parser deve evitare.
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <link rel="alternate" href="https://www.youtube.com/channel/UC2Xd-TjJByJyK2w1zNwY0zQ"/>
  <id>yt:channel:2Xd-TjJByJyK2w1zNwY0zQ</id>
  <yt:channelId>2Xd-TjJByJyK2w1zNwY0zQ</yt:channelId>
  <title>Il Canale</title>
  <published>2017-04-07T18:17:23+00:00</published>
  <entry>
    <id>yt:video:aaaaaaaaaaa</id>
    <yt:videoId>aaaaaaaaaaa</yt:videoId>
    <title>Primo video</title>
    <published>2026-08-20T17:53:37+00:00</published>
  </entry>
  <entry>
    <id>yt:video:bbbbbbbbbbb</id>
    <yt:videoId>bbbbbbbbbbb</yt:videoId>
    <title>Secondo &amp; ultimo</title>
    <published>2026-08-19T18:45:57+00:00</published>
  </entry>
</feed>`;

describe('parseChannelFeed', () => {
  it('estrae i video nell ordine del feed', () => {
    const videos = parseChannelFeed(FEED);
    expect(videos.map((v) => v.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('associa a ogni video la SUA data, non quella del canale', () => {
    // Regressione: con regex globali sul documento il <published> del canale
    // (2017) finirebbe sul primo video, sfasando di uno tutte le date.
    const videos = parseChannelFeed(FEED);
    expect(videos[0].publishedAt).toBe('2026-08-20T17:53:37+00:00');
    expect(videos[1].publishedAt).toBe('2026-08-19T18:45:57+00:00');
  });

  it('associa a ogni video il SUO titolo, non quello del canale', () => {
    const videos = parseChannelFeed(FEED);
    expect(videos[0].title).toBe('Primo video');
  });

  it('decodifica le entità XML nei titoli', () => {
    expect(parseChannelFeed(FEED)[1].title).toBe('Secondo & ultimo');
  });

  it('costruisce l URL del video', () => {
    expect(parseChannelFeed(FEED)[0].url).toBe(
      'https://www.youtube.com/watch?v=aaaaaaaaaaa'
    );
  });

  it('scarta le entry con un videoId non plausibile', () => {
    const rotto = FEED.replace('<yt:videoId>aaaaaaaaaaa</yt:videoId>', '<yt:videoId>x</yt:videoId>');
    expect(parseChannelFeed(rotto)).toHaveLength(1);
  });

  it('restituisce un elenco vuoto su un feed senza entry', () => {
    expect(parseChannelFeed('<feed><title>Vuoto</title></feed>')).toEqual([]);
    expect(parseChannelFeed('')).toEqual([]);
  });

  it('sopravvive a un titolo mancante senza saltare il video', () => {
    const senzaTitolo = FEED.replace('<title>Primo video</title>', '');
    const videos = parseChannelFeed(senzaTitolo);
    expect(videos).toHaveLength(2);
    expect(videos[0].title).toBe('(senza titolo)');
  });
});

describe('parseChannelTitle', () => {
  it('legge il titolo del canale, non quello del primo video', () => {
    expect(parseChannelTitle(FEED)).toBe('Il Canale');
  });

  it('restituisce null se il feed non ha titolo', () => {
    expect(parseChannelTitle('<feed></feed>')).toBeNull();
  });
});

describe('isChannelId', () => {
  it('accetta un channelId nella forma UC + 22 caratteri', () => {
    expect(isChannelId('UC2Xd-TjJByJyK2w1zNwY0zQ')).toBe(true);
  });

  it('rifiuta handle, URL e valori di lunghezza sbagliata', () => {
    expect(isChannelId('@Fireship')).toBe(false);
    expect(isChannelId('https://www.youtube.com/@Fireship')).toBe(false);
    expect(isChannelId('UCtroppocorto')).toBe(false);
  });

  it('rifiuta i valori che uscirebbero dalla cartella dei dati', () => {
    // isChannelId è il guardrail di path traversal usato da videoStore().
    expect(isChannelId('../../etc')).toBe(false);
    expect(isChannelId('UC2Xd-TjJByJyK2w1zNwY0z/../..')).toBe(false);
  });
});

describe('parseChannelIdFromHtml', () => {
  // Un channelId è "UC" + esattamente 22 caratteri: si costruiscono invece di
  // scriverli a mano, così la lunghezza è giusta per definizione.
  const id = (nome: string) => 'UC' + nome.padEnd(22, 'x');
  const SUGGERITO = id('suggerito');
  const GIUSTO = id('giusto');

  // Nella pagina reale di un canale il primo `"channelId"` del markup appartiene
  // a un canale SUGGERITO. Verificato su @Fireship, @veritasium e @mkbhd: usando
  // quello si finiva sul canale sbagliato. Il canonical è l'ancora giusta.
  const PAGINA = `
    <html><head>
      <script>{"channelId":"${SUGGERITO}"}</script>
      <link rel="canonical" href="https://www.youtube.com/channel/${GIUSTO}">
    </head></html>`;

  it('preferisce il canonical al primo channelId che incontra', () => {
    expect(parseChannelIdFromHtml(PAGINA)).toBe(GIUSTO);
  });

  it('ripiega su channel_id quando manca il canonical', () => {
    const html = `<link href="/feeds/videos.xml?channel_id=${GIUSTO}">`;
    expect(parseChannelIdFromHtml(html)).toBe(GIUSTO);
  });

  it('ripiega su externalId prima di accontentarsi di channelId', () => {
    const html = `{"channelId":"${SUGGERITO}","externalId":"${GIUSTO}"}`;
    expect(parseChannelIdFromHtml(html)).toBe(GIUSTO);
  });

  it('usa channelId solo come ultima spiaggia', () => {
    expect(parseChannelIdFromHtml(`{"channelId":"${GIUSTO}"}`)).toBe(GIUSTO);
  });

  it('restituisce null se non c è nessun channelId', () => {
    expect(parseChannelIdFromHtml('<html>niente</html>')).toBeNull();
  });
});
