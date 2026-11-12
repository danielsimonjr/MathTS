import { describe, it, expect } from 'vitest';

/** The first import of @danielsimonjr/mathts-functions takes several seconds cold. */
const COLD_IMPORT_TIMEOUT_MS = 60_000;

/**
 * Issue #937: `parse` threw 'There is already a conversion from "string" to
 * "Node"' after `@danielsimonjr/mathts-functions` was loaded first. The parse
 * factory registered its string-to-Node conversion on a shared typed instance
 * on every run. This file loads functions first, so parse runs a second time.
 */
describe('#937 parse after functions is loaded first', () => {
  it(
    '#937 parse("2+3") does not throw after @danielsimonjr/mathts-functions loads',
    async () => {
      await import('@danielsimonjr/mathts-functions');
      const { parse } = await import('@danielsimonjr/mathts-parser');
      expect(parse('2+3').toString()).toBe('2 + 3');
    },
    COLD_IMPORT_TIMEOUT_MS
  );

  it(
    '#937 a second createParse() run on the same typed instance does not throw',
    async () => {
      await import('@danielsimonjr/mathts-functions');
      const { createParse } = await import('@danielsimonjr/mathts-parser');
      expect(() => createParse()).not.toThrow();
      expect(() => createParse()).not.toThrow();
    },
    COLD_IMPORT_TIMEOUT_MS
  );
});
