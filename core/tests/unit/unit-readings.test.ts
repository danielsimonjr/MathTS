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
});
