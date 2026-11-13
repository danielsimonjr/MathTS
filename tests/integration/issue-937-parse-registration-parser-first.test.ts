import { describe, it, expect } from 'vitest';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { parse } from '@danielsimonjr/mathts-parser';

/** The first import of @danielsimonjr/mathts-functions takes several seconds cold. */
const COLD_IMPORT_TIMEOUT_MS = 60_000;

/**
 * Issue #937, reverse load order: parse runs first, then functions loads. The
 * string-to-Node converter on the shared typed instance belongs to functions, so
 * a string argument converts through functions' own parse in both load orders.
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

  it(
    '#937 functions simplify matches functions-alone result after parse ran first',
    async () => {
      parse('2+3');
      const { simplify } = await import('@danielsimonjr/mathts-functions');
      expect(simplify('x + x').toString()).toBe('2 * x');
    },
    COLD_IMPORT_TIMEOUT_MS
  );

  it(
    '#937 the string-to-Node converter builds functions nodes, not the default parse nodes',
    async () => {
      const thinNode = parse('x');
      const fns = await import('@danielsimonjr/mathts-functions');
      const converted = mathTyped.convert('x', 'Node');
      expect(converted).toBeInstanceOf(fns.parse('x').constructor);
      expect(converted).not.toBeInstanceOf(thinNode.constructor);
    },
    COLD_IMPORT_TIMEOUT_MS
  );
});
