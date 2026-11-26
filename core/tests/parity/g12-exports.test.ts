import { describe, it, expect } from 'vitest';
import * as core from '../../src/index.js';
import * as mathjs from 'mathjs';

/**
 * G12 export-surface decisions (#1567, #1571): the canonical error classes live on
 * `@danielsimonjr/mathts-core` (not only the `/internal` subpath), and the lowercase
 * mathjs constant names (`pi`, `e`, `tau`, `phi`, `i`) are exported as aliases of the
 * uppercase MathTS constants.
 */
const CLASSES = ['DimensionError', 'IndexError'] as const;
const ALIASES = [
  ['pi', 'PI'],
  ['e', 'E'],
  ['tau', 'TAU'],
  ['phi', 'PHI'],
  ['i', 'I'],
] as const;

describe('G12 core export surface (#1567, #1571)', () => {
  it('exports the canonical error classes', () => {
    for (const name of CLASSES) {
      const value = (core as unknown as Record<string, unknown>)[name];
      expect(value, `${name} must be exported from @danielsimonjr/mathts-core`).toBeDefined();
      expect(typeof value, `${name} must be a class`).toBe('function');
    }
  });

  it('the error classes are the single canonical identity', () => {
    const DimensionError = core.DimensionError;
    const err = new DimensionError(2, 3);
    expect(err).toBeInstanceOf(RangeError);
    expect(err.isDimensionError).toBe(true);
  });

  it('exports the lowercase mathjs constant aliases', () => {
    for (const [lower, upper] of ALIASES) {
      expect(
        (core as unknown as Record<string, unknown>)[lower],
        `${lower} must be exported`
      ).toBeDefined();
      expect(
        (core as unknown as Record<string, unknown>)[lower],
        `${lower} must alias ${upper}`
      ).toBe((core as unknown as Record<string, unknown>)[upper]);
    }
  });

  it('the exported names match the mathjs oracle surface for these names', () => {
    const oracle = new Set(Object.keys(mathjs));
    for (const name of [...CLASSES, ...ALIASES.map(([l]) => l)]) {
      expect(oracle.has(name), `mathjs 15.3.0 exports ${name}`).toBe(true);
    }
  });
});
