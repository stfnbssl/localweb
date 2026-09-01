import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  parseReportAsset,
  reportAssetPath,
  extractMetaTitle,
} from '../src/reports/catalog';

const CH = 'UC39jphb_m0Cv6MHHWGyP8iQ';

describe('parseReportAsset', () => {
  it('riconosce la pagina e il corpus del canale', () => {
    expect(parseReportAsset(`/${CH}/index.html`)).toEqual({
      channelId: CH,
      file: 'index.html',
    });
    expect(parseReportAsset(`/${CH}/synthesis.json`)).toEqual({
      channelId: CH,
      file: 'synthesis.json',
    });
    expect(parseReportAsset(`/${CH}/assets/stile.css`)).toEqual({
      channelId: CH,
      file: 'assets/stile.css',
    });
  });

  it('rifiuta la risalita, anche codificata in percentuale', () => {
    expect(parseReportAsset(`/${CH}/../channels.jsonl`)).toBeNull();
    expect(parseReportAsset(`/${CH}/%2e%2e/channels.jsonl`)).toBeNull();
    expect(parseReportAsset(`/${CH}/..%2fchannels.jsonl`)).toBeNull();
    expect(parseReportAsset(`/${CH}/.env`)).toBeNull();
    expect(parseReportAsset(`/${CH}/%00.html`)).toBeNull();
    expect(parseReportAsset(`/${CH}\\index.html`)).toBeNull();
    expect(parseReportAsset(`/${CH}/%zz`)).toBeNull(); // percentuale malformata
  });

  it('accetta solo un ID di canale ben formato al primo segmento', () => {
    expect(parseReportAsset('/altro/index.html')).toBeNull();
    expect(parseReportAsset('/UCtroppocorto/index.html')).toBeNull();
    expect(parseReportAsset(`/${CH}`)).toBeNull(); // il solo canale non è un file
  });
});

describe('reportAssetPath', () => {
  it('serve la pagina dal visualizzatore condiviso, non dalla cartella del canale', () => {
    const file = reportAssetPath({ channelId: CH, file: 'index.html' });
    expect(file).not.toBeNull();
    // Una sola pagina per tutti i canali: il channelId non compare nel percorso.
    expect(file!.split(path.sep)).toContain('viewer');
    expect(file).not.toContain(CH);
    expect(path.basename(file!)).toBe('index.html');
  });

  it('serve il corpus dalla cartella del canale', () => {
    const file = reportAssetPath({ channelId: CH, file: 'synthesis.json' });
    expect(file).not.toBeNull();
    expect(file!.split(path.sep)).toContain(CH);
    expect(path.basename(file!)).toBe('synthesis.json');
  });

  it('non lascia uscire dalla cartella del canale', () => {
    // Ridondante rispetto a parseReportAsset, ed è voluto: è l'ultimo controllo
    // prima di aprire un file.
    expect(reportAssetPath({ channelId: CH, file: '../../viewer/index.html' })).toBeNull();
    expect(reportAssetPath({ channelId: CH, file: '../altro/synthesis.json' })).toBeNull();
  });
});

describe('extractMetaTitle', () => {
  it('legge meta.title dalla testa del corpus', () => {
    const head = '{\n "meta": {\n  "corpus_id": "statrys",\n  "title": "Sintesi del corpus",\n  "themes": 13';
    expect(extractMetaTitle(head)).toBe('Sintesi del corpus');
  });

  it('decodifica le sequenze di escape JSON e normalizza gli spazi', () => {
    const head = '{"meta":{"title":"Corpus \\"Cina\\"\\n  e dollaro"}}';
    expect(extractMetaTitle(head)).toBe('Corpus "Cina" e dollaro');
  });

  it('restituisce null quando il titolo manca o è vuoto', () => {
    expect(extractMetaTitle('{"meta":{"corpus_id":"x"}}')).toBeNull();
    expect(extractMetaTitle('{"meta":{"title":"   "}}')).toBeNull();
    // Un titolo fuori da meta non conta: verrebbe da un'altra parte del corpus.
    expect(extractMetaTitle('{"videos":[{"title":"un video"}]}')).toBeNull();
  });
});
