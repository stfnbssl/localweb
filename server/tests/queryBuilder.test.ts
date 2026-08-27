import { describe, it, expect } from 'vitest';
import { buildQueryString } from '../src/research/queryBuilder';
import type { Category, LocalizedLabel } from '../src/research/models';

// Costruisce una Category minimale: al builder servono solo `labels`, il resto
// dei campi è rumore che renderebbe i casi illeggibili.
function cat(labels: LocalizedLabel[]): Category {
  return {
    id: 'x',
    themeId: 't',
    dimension: 'd',
    labels,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

const en = (text: string): LocalizedLabel => ({ text, lang: 'en' });
const ita = (text: string): LocalizedLabel => ({ text, lang: 'it' });

describe('buildQueryString', () => {
  it('un gruppo con una sola categoria non viene parentesizzato', () => {
    expect(buildQueryString([[cat([en('hospital')])]], 'en')).toBe('"hospital"');
  });

  it('categorie dello stesso gruppo vanno in OR dentro parentesi', () => {
    const groups = [[cat([en('developmental screening')]), cat([en('early detection')])]];
    expect(buildQueryString(groups, 'en')).toBe(
      '("developmental screening" OR "early detection")'
    );
  });

  it('gruppi diversi vanno in AND, nell ordine ricevuto', () => {
    const groups = [
      [cat([en('developmental screening')]), cat([en('early detection')])],
      [cat([en('hospital')])],
    ];
    expect(buildQueryString(groups, 'en')).toBe(
      '("developmental screening" OR "early detection") AND "hospital"'
    );
  });

  it('ripiega sulla prima etichetta quando la lingua richiesta manca', () => {
    // La categoria esiste solo in inglese ma la query è in italiano: meglio
    // l etichetta sbagliata di lingua che nessun termine di ricerca.
    const groups = [[cat([en('hospital')])]];
    expect(buildQueryString(groups, 'it')).toBe('"hospital"');
  });

  it('sceglie l etichetta nella lingua richiesta quando c è', () => {
    const groups = [[cat([en('hospital'), ita('ospedale')])]];
    expect(buildQueryString(groups, 'it')).toBe('"ospedale"');
  });

  it('deduplica le etichette identiche dentro lo stesso gruppo', () => {
    // Due categorie di temi diversi possono portare la stessa etichetta:
    // ("hospital" OR "hospital") sarebbe rumore inviato al motore.
    const groups = [[cat([en('hospital')]), cat([en('hospital')])]];
    expect(buildQueryString(groups, 'en')).toBe('"hospital"');
  });

  it('salta i gruppi vuoti senza lasciare AND penzolanti', () => {
    const groups = [[cat([en('hospital')])], [], [cat([en('nurse')])]];
    expect(buildQueryString(groups, 'en')).toBe('"hospital" AND "nurse"');
  });

  it('salta i gruppi in cui nessuna categoria ha etichette', () => {
    const groups = [[cat([en('hospital')])], [cat([])]];
    expect(buildQueryString(groups, 'en')).toBe('"hospital"');
  });

  it('restituisce stringa vuota se non c è nulla da cercare', () => {
    expect(buildQueryString([], 'en')).toBe('');
    expect(buildQueryString([[], []], 'en')).toBe('');
  });
});
