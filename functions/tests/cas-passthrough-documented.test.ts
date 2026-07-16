// Characterization test: these CAS transforms are currently pass-through
// (Phase 8 will implement them). When implemented, update these expectations
// AND docs/reference/functions.md.
import { describe, it, expect } from 'vitest';
import { factor, expand, casFactor, casExpand, apart, together } from '../src/index.js';

describe('CAS transforms are pass-through today (documented limitation)', () => {
  it('factor is a no-op pending implementation', () => {
    expect(factor('x^2-1')).toBe('x^2-1');
  });

  it('expand is a no-op pending implementation', () => {
    expect(expand('(x+1)^3')).toBe('(x+1)^3');
  });

  it('casFactor is a no-op pending implementation', () => {
    expect(casFactor('x^2-1')).toBe('x^2-1');
  });

  it('casExpand is a no-op pending implementation', () => {
    expect(casExpand('(x+1)^3')).toBe('(x+1)^3');
  });

  it('apart is a no-op pending implementation', () => {
    expect(apart('1/(x^2-1)')).toBe('1/(x^2-1)');
  });

  it('together is a no-op pending implementation', () => {
    expect(together('1/x+1/(x+1)')).toBe('1/x+1/(x+1)');
  });
});
