import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/index.js';

const CONTROLS = [
  'µmK',
  'μmK',
  '°Rm',
  'ΩK',
  'Åm',
  'm⁺²K',
  'm^2K',
  'umK',
  'mAs',
  '℃m',
  'm²K',
  'm⁻¹K',
];

describe('Unit.readingsWithSource', () => {
  it('gives the source text of each factor: µmK gives µm then K', () => {
    expect(Unit.readingsWithSource('µmK')).toContainEqual([
      { name: 'um', power: 1, source: 'µm' },
      { name: 'K', power: 1, source: 'K' },
    ]);
  });
  it('keeps the canonical name of a sign spelling and the sign as the source', () => {
    expect(Unit.readingsWithSource('ΩK')).toContainEqual([
      { name: 'ohm', power: 1, source: 'Ω' },
      { name: 'K', power: 1, source: 'K' },
    ]);
    expect(Unit.readingsWithSource('m⁺²K')).toContainEqual([
      { name: 'm', power: 2, source: 'm⁺²' },
      { name: 'K', power: 1, source: 'K' },
    ]);
  });
  it.each(CONTROLS)('reassembles %s byte for byte from the sources of every reading', (token) => {
    const ways = Unit.readingsWithSource(token);
    expect(ways.length).toBeGreaterThan(0);
    for (const way of ways) {
      expect(way.map((f) => f.source).join('')).toBe(token);
    }
  });
  it('gives the degree sign to deg and the letter to the next factor in °Rm', () => {
    expect(Unit.readingsWithSource('°Rm')).toContainEqual([
      { name: 'deg', power: 1, source: '°' },
      { name: 'Rm', power: 1, source: 'Rm' },
    ]);
  });
  it('gives the full sign ℃ to the next factor when a cut falls inside it', () => {
    expect(Unit.readingsWithSource('℃m')).toContainEqual([
      { name: 'deg', power: 1, source: '' },
      { name: 'C', power: 1, source: '℃' },
      { name: 'm', power: 1, source: 'm' },
    ]);
  });
  it('gives several readings for the ambiguous token umK', () => {
    expect(Unit.readingsWithSource('umK').length).toBeGreaterThan(1);
  });
  it.each(CONTROLS)('gives the same names and powers as Unit.readings for %s', (token) => {
    const plain = Unit.readingsWithSource(token).map((w) =>
      w.map((f) => ({ name: f.name, power: f.power }))
    );
    expect(plain).toEqual(Unit.readings(token));
  });
  it('does not change the shape of Unit.readings', () => {
    for (const way of Unit.readings('µmK')) {
      for (const f of way) expect(Object.keys(f).sort()).toEqual(['name', 'power']);
    }
  });
});
