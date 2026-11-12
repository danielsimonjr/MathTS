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
    '#937 functions simplify still accepts a string after parse ran first',
    async () => {
      parse('2+3');
      const { simplify } = await import('@danielsimonjr/mathts-functions');
      // The string converts to a Node: simplify accepts it and returns a Node.
      const result = simplify('x + x') as { isNode?: boolean };
      expect(result.isNode).toBe(true);
    },
    COLD_IMPORT_TIMEOUT_MS
  );
});
