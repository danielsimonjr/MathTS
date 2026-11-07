import { describe, expect, it } from 'vitest';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng, Fraction } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  searchScalars,
  unitToRationalDimension,
  type ScalarSearchOptions,
  type ScalarSearchProblem,
  type SearchProgress,
} from '../src/index.js';
import type { RationalDimension } from '../src/scalar-dimension.js';

const b = createScalarBuilder();
const X = b.symbol('x');

const si = (
  l: number,
  m: number,
  t: number,
  i: number,
  th: number,
  n: number,
  j: number
): RationalDimension => [
  new Fraction(BigInt(l), 1n),
  new Fraction(BigInt(m), 1n),
  new Fraction(BigInt(t), 1n),
  new Fraction(BigInt(i), 1n),
  new Fraction(BigInt(th), 1n),
  new Fraction(BigInt(n), 1n),
  new Fraction(BigInt(j), 1n),
];

const length = si(1, 0, 0, 0, 0, 0, 0);
const time = si(0, 0, 1, 0, 0, 0, 0);

const linspace = (n: number, lo: number, hi: number): Float64Array => {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = lo + ((hi - lo) * i) / (n - 1);
  }
  return out;
};
const xs = linspace(20, -1, 1);
const observedOf = (node: ScalarNode, x: Float64Array): Float64Array =>
  compileScalar(node, { variables: ['x'] }).evaluate([x]).values;

const sumKey = '{"k":"+","a":[{"k":"s","v":"x"},{"k":"s","v":"x"}]}';
const sumProblem: ScalarSearchProblem = {
  variables: ['x'],
  columns: [xs],
  observed: observedOf(b.op('+', [X, X]), xs),
};
const sumGrammar: ScalarGrammar = {
  variables: ['x'],
  binary: ['+'],
  unary: ['sin'],
  literals: [],
  maxSize: 3,
};

async function keysFor(
  options: Partial<ScalarSearchOptions> & { dimensions?: unknown }
): Promise<string[]> {
  const gen = searchScalars(sumProblem, {
    grammar: sumGrammar,
    rng: createSeededRng(7),
    maxEvaluations: 50,
    ...options,
  } as ScalarSearchOptions);
  const progress: SearchProgress[] = [];
  for (;;) {
    const step = await gen.next();
    if (step.done) {
      return step.value.front.map((row) => scalarCanonicalKey(row.item));
    }
    progress.push(step.value);
  }
}

describe('unitToRationalDimension options.mapUnit', () => {
  it('throws for bit without the option', () => {
    expect(() => unitToRationalDimension('bit')).toThrow(/information|bit/i);
  });

  it('returns the caller vector itself (toBe) for bit', () => {
    const dim = si(0, 0, 0, 1, 0, 0, 0);
    expect(unitToRationalDimension('bit', { mapUnit: () => dim })).toBe(dim);
  });

  it('throws when mapUnit returns a vector of the wrong length', () => {
    expect(() =>
      unitToRationalDimension('bit', {
        mapUnit: () => [new Fraction(1n, 1n), new Fraction(2n, 1n)] as never,
      })
    ).toThrow();
  });

  it('throws TypeError when mapUnit is not a function', () => {
    expect(() => unitToRationalDimension('bit', { mapUnit: 5 as never })).toThrow(TypeError);
  });
});

describe('searchScalars dimensions.equal', () => {
  it('equal true keeps x + x for a time target, which the default filter rejects', async () => {
    const defaultKeys = await keysFor({
      dimensions: { symbols: { x: length }, target: time },
    } as never);
    expect(defaultKeys).not.toContain(sumKey);
    const keys = await keysFor({
      dimensions: { symbols: { x: length }, target: time, equal: () => true },
    } as never);
    expect(keys).toContain(sumKey);
  });

  it('equal false rejects x + x', async () => {
    const keys = await keysFor({
      dimensions: { symbols: { x: length }, target: length, equal: () => false },
    } as never);
    expect(keys).not.toContain(sumKey);
  });

  it('equal that throws behaves like the rejecting case', async () => {
    const keys = await keysFor({
      dimensions: {
        symbols: { x: length },
        target: length,
        equal: () => {
          throw new Error('x');
        },
      },
    } as never);
    expect(keys).not.toContain(sumKey);
  });

  it('a non-function equal rejects with RangeError naming dimensions.equal', async () => {
    await expect(
      keysFor({
        dimensions: { symbols: { x: length }, target: time, equal: 'no' as never },
      } as never)
    ).rejects.toThrow(RangeError);
    await expect(
      keysFor({
        dimensions: { symbols: { x: length }, target: time, equal: 'no' as never },
      } as never)
    ).rejects.toThrow(/dimensions\.equal/);
  });
});
