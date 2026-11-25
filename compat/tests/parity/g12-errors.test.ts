import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { DimensionError } from '@danielsimonjr/mathts-core';

/**
 * #1567: the dimension mismatch thrown from the compat instance's typed
 * elementwise arithmetic is the single canonical `DimensionError` from
 * `@danielsimonjr/mathts-core`, so `instanceof` holds across the package
 * boundary. (mathjs 15.3.0 throws a plain `Error` here — MathTS keeps the
 * more precise class; recorded as an intentional divergence.)
 */
describe('G12 compat instance dimension errors (#1567)', () => {
  it('add of different-length arrays throws the canonical DimensionError', () => {
    const math = createCompat(compatAll, {});
    expect(() => math.add([1, 2], [1, 2, 3] as unknown as number[])).toThrow(DimensionError);
    try {
      math.add([1, 2], [1, 2, 3] as unknown as number[]);
      expect.unreachable('add must throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DimensionError);
      expect((err as Error).message).toContain('Dimension mismatch (2 != 3)');
    }
  });
});
