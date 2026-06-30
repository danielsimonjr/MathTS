import { describe, it, expect } from 'vitest';
import * as fns from '@danielsimonjr/mathts-functions';

/**
 * GC4 — mathjs canonical-name parity. Five functions were only exported under a
 * `factory_`-prefixed or renamed identifier; `help` was missing entirely. This
 * pins the bare mathjs spellings so `import { cumsum } from '...'` works.
 */
describe('GC4: mathjs canonical-name aliases', () => {
  it('bare names alias their renamed source exports', () => {
    const m = fns as Record<string, unknown>;
    expect(m.cumsum).toBe(m.factory_cumsum);
    expect(m.ctranspose).toBe(m.factory_ctranspose);
    expect(m.createUnit).toBe(m.factory_createUnit);
    expect(m.apply).toBe(m.mapSlices);
    expect(m.index).toBe(m.indexFn);
  });

  it('cumsum computes a cumulative sum', () => {
    expect((fns as { cumsum: (a: number[]) => number[] }).cumsum([1, 2, 3, 4])).toEqual([
      1, 3, 6, 10,
    ]);
  });

  it('help returns documentation for a function name', () => {
    const help = (fns as { help: (s: string) => unknown }).help;
    expect(typeof help).toBe('function');
    const doc = help('sin');
    expect(String(doc)).toMatch(/sin/i);
  });

  it('help throws for an unknown name', () => {
    const help = (fns as { help: (s: string) => unknown }).help;
    expect(() => help('not_a_real_function_xyz')).toThrow(/No documentation/);
  });
});
