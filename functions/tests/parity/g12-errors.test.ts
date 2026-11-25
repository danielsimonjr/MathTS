import { describe, it, expect } from 'vitest';
import { add, subtract } from '../../src/index.js';
import { DimensionError } from '@danielsimonjr/mathts-core';

/**
 * #1567: a dimension mismatch thrown from the typed elementwise arithmetic is the
 * single canonical `DimensionError` from `@danielsimonjr/mathts-core`, so a caller
 * can `instanceof`-check it against the exported class. (mathjs 15.3.0 throws a
 * plain `Error` for these — MathTS keeps the more precise class; see the
 * `Intentional divergences` note in docs/api/compat.md.)
 */
describe('G12 dimension errors are the canonical classes (#1567)', () => {
  it('add of different-length arrays throws the core DimensionError', () => {
    expect(() => add([1, 2], [1, 2, 3])).toThrow(DimensionError);
    try {
      add([1, 2], [1, 2, 3]);
      expect.unreachable('add must throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DimensionError);
      expect((err as Error).message).toContain('Dimension mismatch (2 != 3)');
    }
  });

  it('subtract of different-length arrays throws the core DimensionError', () => {
    expect(() => subtract([1, 2], [1, 2, 3])).toThrow(DimensionError);
  });
});
