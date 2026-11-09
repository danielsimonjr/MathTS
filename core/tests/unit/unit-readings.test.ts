import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/index.js';

function spellings(token: string): string[] {
  return Unit.readings(token).map((r) =>
    r.map((f) => (f.power === 1 ? f.name : `${f.name}^${f.power}`)).join('*')
  );
}

describe('Unit.readings (M6)', () => {
  it('lists every product reading of a glued token', () => {
    expect(spellings('mAs')).toEqual(expect.arrayContaining(['m*A*s', 'mA*s']));
    expect(spellings('Pas')).toEqual(expect.arrayContaining(['Pa*s']));
    expect(spellings('Pam')).toEqual(expect.arrayContaining(['Pa*m']));
  });
  it('reads a trailing digit run as an integer power', () => {
    expect(spellings('m2K')).toContain('m^2*K');
  });
  it('is raw: mN keeps the product m*N that parse does not choose', () => {
    expect(spellings('mN')).toContain('m*N');
  });
  it('keeps NN and drops the prefix repeat m*m', () => {
    expect(spellings('NN')).toContain('N*N');
    expect(spellings('mm')).not.toContain('m*m');
  });
  it('returns only readings of two or more factors', () => {
    expect(Unit.readings('N')).toEqual([]);
    for (const r of Unit.readings('mAs')) expect(r.length).toBeGreaterThanOrEqual(2);
  });
  it('returns an empty list for a token with no reading', () => {
    expect(Unit.readings('qqq')).toEqual([]);
  });
  it('reads the degree spellings that parse reads (°R, °C, °F, µ)', () => {
    expect(spellings('m°R')).toContain('m*degR');
    expect(spellings('K°R')).toContain('K*degR');
    expect(spellings('W°C')).toContain('W*degC');
    expect(spellings('µAs')).toContain('uA*s');
  });
  it('is raw for ly and pc: a factor takes every SI prefix, also below kilo', () => {
    // Unit.parse refuses mpc and zly, because ly and pc accept only k and larger prefixes.
    // The raw list does not apply this rule.
    expect(spellings('Hzpc')).toEqual(expect.arrayContaining(['Hz*pc', 'H*zpc']));
    expect(spellings('lmpc')).toContain('l*mpc');
    expect(spellings('Kmly')).toContain('K*mly');
  });
  it('keeps the parse lookup and the raw lookup apart in the lookup cache', () => {
    Unit.deleteUnit('readingsCacheProbe'); // Clears the lookup cache.
    expect(Unit.isValuelessUnit('1:zpc')).toBe(false);
    expect(Unit.isValuelessUnit('+zpc')).toBe(false);
    expect(spellings('Hzpc')).toContain('H*zpc');
    expect(Unit.isValuelessUnit('zpc')).toBe(false);
  });
  it('keeps the k-and-up rule in parse', () => {
    expect(() => Unit.parse('mpc')).toThrow(/not found/);
    expect(() => Unit.parse('mly')).toThrow(/not found/);
    expect(Unit.parse('Hzpc').toString()).toBe('Hz pc');
  });
});

// The micro sign is the micro prefix only. It is never the atomic mass unit u.
describe.each(['µ', 'μ'])('the micro sign %s', (mu) => {
  it('gives no reading with the unit u as a factor', () => {
    for (const r of Unit.readings(mu + 'mK')) {
      expect(r.map((f) => f.name)).not.toContain('u');
    }
    expect(spellings(mu + 'mK')).toEqual(['um*K']);
  });
  it('keeps the prefix readings', () => {
    expect(spellings(mu + 'As')).toEqual(['uA*s']);
    expect(spellings(mu + 'u')).toEqual([]);
  });
  it('is not the unit u in parse', () => {
    expect(() => Unit.parse('5 ' + mu)).toThrow();
    expect(() => Unit.parse('5 ' + mu + '/s')).toThrow();
    expect(() => Unit.parse('5 N' + mu)).toThrow();
    expect(Unit.parse('1 ' + mu + 'm').toString()).toBe('1 um');
    expect(Unit.parse('1 N' + mu + 'm').toString()).toBe('1 N um');
    expect(() => Unit.parse(mu + 'As')).toThrow(/not found/);
  });
});

describe('the letter u', () => {
  it('keeps every reading of umK', () => {
    expect(spellings('umK')).toEqual(['u*m*K', 'u*mK', 'um*K']);
    expect(Unit.parse('5 u').toString()).toBe('5 u');
  });
});
