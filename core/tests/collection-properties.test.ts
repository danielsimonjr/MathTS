import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deepForEach, deepMap, reduce } from '../src/collection.js';

const FC = { seed: 0x5eed, numRuns: 100 } as const;

type NestedNum = number | NestedNum[];

function nestedNumsArb(remainingDepth: number): fc.Arbitrary<NestedNum> {
  const leaf = fc.double({ noNaN: false });
  if (remainingDepth === 0) return leaf;
  return fc.oneof(leaf, fc.array(nestedNumsArb(remainingDepth - 1), { maxLength: 8 }));
}

/** Oracle: map `fn` over numeric leaves, preserving nested shape. */
function walkMap(value: unknown, fn: (n: number) => number): unknown {
  if (typeof value === 'number') return fn(value);
  if (Array.isArray(value)) return value.map((v) => walkMap(v, fn));
  return value;
}

/** Oracle: visit numeric leaves left-to-right. */
function walkCollect(value: unknown, out: number[]): void {
  if (typeof value === 'number') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkCollect(v, out);
  }
}

function structuralEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => structuralEqual(v, b[i]));
  }
  return false;
}

describe('collection properties (fast-check)', () => {
  it('deepMap identity matches a recursive walk oracle', () => {
    fc.assert(
      fc.property(nestedNumsArb(3), (input) => {
        const id = (x: number) => x;
        expect(structuralEqual(deepMap(input, id), walkMap(input, id))).toBe(true);
      }),
      FC
    );
  });

  it('deepMap fusion: deepMap(deepMap(a, f), g) equals walk of g∘f', () => {
    fc.assert(
      fc.property(
        nestedNumsArb(3),
        fc.integer({ min: -20, max: 20 }),
        fc.integer({ min: -20, max: 20 }),
        (input, a, b) => {
          const f = (x: number) => x + a;
          const g = (x: number) => x * b + 0.5;
          const fused = deepMap(deepMap(input, f), g);
          const oracle = walkMap(input, (x) => g(f(x)));
          expect(structuralEqual(fused, oracle)).toBe(true);
        }
      ),
      FC
    );
  });

  it('deepForEach visits each leaf once, left to right', () => {
    fc.assert(
      fc.property(nestedNumsArb(3), (input) => {
        const visited: number[] = [];
        deepForEach(input, (n) => visited.push(n));
        const oracle: number[] = [];
        walkCollect(input, oracle);
        expect(visited).toEqual(oracle);
      }),
      FC
    );
  });

  it('reduce of a vector by addition matches a for-loop oracle', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ noNaN: false }), { maxLength: 8 }), (vec) => {
        const result = reduce(vec, 0, (acc, val) => Number(acc) + Number(val));
        let sum = 0;
        for (let i = 0; i < vec.length; i++) sum += vec[i];
        if (vec.length === 0) {
          expect(result).toBeUndefined();
        } else {
          expect(result).toBe(sum);
        }
      }),
      FC
    );
  });

  it('deepMap on an empty array is []', () => {
    expect(deepMap([], (x) => x)).toEqual([]);
  });
});
