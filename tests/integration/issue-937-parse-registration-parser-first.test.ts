import { describe, it, expect } from 'vitest';
import { parse } from '@danielsimonjr/mathts-parser';

/** The first import of @danielsimonjr/mathts-functions takes several seconds cold. */
const COLD_IMPORT_TIMEOUT_MS = 60_000;

/**
 * Issue #937, reverse load order: parse runs first, then functions loads and
 * runs its own parse factory on the same typed instance. A string argument must
 * still convert to a Node for functions.
 */
describe('#937 functions after parse is loaded first', () => {
  it(
    '#937 parse("2+3") then functions load: no conversion error',
    async () => {
      expect(parse('2+3').toString()).toBe('2 + 3');
      await import('@danielsimonjr/mathts-functions');
    },
    COLD_IMPORT_TIMEOUT_MS
  );

  it(
    '#937 functions derivative accepts a string after parse ran first',
    async () => {
      parse('2+3');
      const { derivative } = await import('@danielsimonjr/mathts-functions');
      expect(derivative('x^2', 'x').toString()).toBe('2 * x');
    },
    COLD_IMPORT_TIMEOUT_MS
  );

  // Open design point: the shared string-to-Node converter belongs to the first
  // parse that registers it. When the thin default parse runs first, it owns the
  // converter, and simplify returns 'x + x' instead of '2 * x'. This assertion
  // fails until the converter owner is decided.
  it(
    '#937 functions simplify matches functions-alone result after parse ran first',
    async () => {
      parse('2+3');
      const { simplify } = await import('@danielsimonjr/mathts-functions');
      expect(simplify('x + x').toString()).toBe('2 * x');
    },
    COLD_IMPORT_TIMEOUT_MS
  );
});
