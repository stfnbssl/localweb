import { describe, it, expect } from 'vitest';
import { parseResult } from '../src/research/coworkExtractor';
import { parseResults } from '../src/research/searchEngines/web';

// Questi due parser sono l unico punto in cui entra testo generato da un modello:
// il formato non è garantito da nessuno schema, quindi i casi qui sotto sono
// quelli che Claude produce davvero (fence, prosa attorno, chiavi diverse).

describe('parseResult (categorie)', () => {
  const category = { dimension: 'setting', labels: [{ text: 'hospital', lang: 'en' }] };

  it('legge un array JSON nudo', () => {
    expect(parseResult(JSON.stringify([category]))).toEqual([
      { dimension: 'setting', labels: [{ text: 'hospital', lang: 'en' }] },
    ]);
  });

  it('legge un oggetto con chiave "categories"', () => {
    expect(parseResult(JSON.stringify({ categories: [category] }))).toHaveLength(1);
  });

  it('estrae il JSON da un fence ```json', () => {
    const text = 'Ecco le categorie:\n\n```json\n' + JSON.stringify([category]) + '\n```\n';
    expect(parseResult(text)).toHaveLength(1);
  });

  it('estrae il JSON da un fence senza linguaggio', () => {
    const text = '```\n' + JSON.stringify([category]) + '\n```';
    expect(parseResult(text)).toHaveLength(1);
  });

  it('normalizza spazi e lingua delle etichette', () => {
    const text = JSON.stringify([
      { dimension: '  setting  ', labels: [{ text: '  hospital  ', lang: ' EN ' }] },
    ]);
    expect(parseResult(text)).toEqual([
      { dimension: 'setting', labels: [{ text: 'hospital', lang: 'en' }] },
    ]);
  });

  it('scarta le etichette con campi del tipo sbagliato', () => {
    const text = JSON.stringify([
      {
        dimension: 'setting',
        labels: [
          { text: 'hospital', lang: 'en' },
          { text: 42, lang: 'en' },
          { text: 'clinica' },
          null,
        ],
      },
    ]);
    expect(parseResult(text)[0].labels).toEqual([{ text: 'hospital', lang: 'en' }]);
  });

  it('scarta le categorie senza dimension o rimaste senza etichette', () => {
    const text = JSON.stringify([
      category,
      { dimension: 'vuota', labels: [] },
      { dimension: 42, labels: [{ text: 'x', lang: 'en' }] },
      { labels: [{ text: 'y', lang: 'en' }] },
    ]);
    expect(parseResult(text)).toHaveLength(1);
  });

  it('solleva un errore se il JSON non contiene un array di categorie', () => {
    expect(() => parseResult(JSON.stringify({ altro: [] }))).toThrow(/categories/);
  });

  it('solleva un errore se la risposta non è JSON', () => {
    // Il caso reale: il modello risponde in prosa invece che con il JSON.
    expect(() => parseResult('Mi dispiace, non ho capito la richiesta.')).toThrow();
  });
});

describe('parseResults (ricerca web)', () => {
  const hit = {
    title: 'Titolo',
    url: 'https://example.org/a',
    site: 'example.org',
    year: 2024,
    snippet: 'Estratto',
  };

  it('mappa i campi sul formato RawResult', () => {
    expect(parseResults(JSON.stringify([hit]), 10)).toEqual([
      {
        title: 'Titolo',
        authors: ['example.org'],
        year: 2024,
        doi: null,
        url: 'https://example.org/a',
        abstract: 'Estratto',
      },
    ]);
  });

  it('legge un oggetto con chiave "results"', () => {
    expect(parseResults(JSON.stringify({ results: [hit] }), 10)).toHaveLength(1);
  });

  it('estrae il JSON da un fence ```json', () => {
    const text = '```json\n' + JSON.stringify([hit]) + '\n```';
    expect(parseResults(text, 10)).toHaveLength(1);
  });

  it('azzera i campi opzionali di tipo sbagliato invece di propagarli', () => {
    const text = JSON.stringify([{ title: 'T', url: 'https://e.org', year: '2024', site: '  ' }]);
    expect(parseResults(text, 10)[0]).toMatchObject({
      year: null,
      authors: [],
      abstract: null,
    });
  });

  it('scarta i risultati senza title o url utilizzabili', () => {
    const text = JSON.stringify([
      hit,
      { title: 'Senza url' },
      { url: 'https://e.org/senza-titolo' },
      { title: 42, url: 'https://e.org/b' },
      null,
    ]);
    expect(parseResults(text, 10)).toHaveLength(1);
  });

  it('tronca a max risultati', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...hit, url: `https://e.org/${i}` }));
    expect(parseResults(JSON.stringify(many), 2)).toHaveLength(2);
  });

  it('solleva un errore se il JSON non contiene un array di risultati', () => {
    expect(() => parseResults(JSON.stringify({ altro: [] }), 10)).toThrow(/results/);
  });

  it('solleva un errore se la risposta non è JSON', () => {
    expect(() => parseResults('Nessun risultato trovato.', 10)).toThrow();
  });
});
