/**
 * P7-1 pins: dense QR number fast path, resume fallback, and Complex generic path.
 * Goldens captured from the pre-optimization implementation (Object.is on number cells).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { qr } from '../src/factories/index.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/p7-qr-golden.jsonl');

type GoldenCase = {
  name: string;
  A: unknown[][];
  Q: unknown[][];
  R: unknown[][];
};

function jsonReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (o.__num === 'NaN') return NaN;
    if (o.__num === '-0') return -0;
    if (o.__num === 'Infinity') return Infinity;
    if (o.__num === '-Infinity') return -Infinity;
    if (o.__complex === true) return { re: o.re as number, im: o.im as number };
  }
  return value;
}

function loadGoldens(): GoldenCase[] {
  return readFileSync(fixturePath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line, jsonReviver) as GoldenCase);
}

function isComplexLike(v: unknown): v is { re: number; im: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    're' in v &&
    'im' in v &&
    typeof (v as { re: unknown }).re === 'number' &&
    typeof (v as { im: unknown }).im === 'number'
  );
}

function expectMatrixBitExact(actual: unknown[][], expected: unknown[][]): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].length).toBe(expected[i]!.length);
    for (let j = 0; j < actual[i]!.length; j++) {
      const a = actual[i]![j];
      const e = expected[i]![j];
      if (isComplexLike(a) || isComplexLike(e)) {
        expect(isComplexLike(a)).toBe(true);
        expect(isComplexLike(e)).toBe(true);
        expect(Object.is(a.re, e.re)).toBe(true);
        expect(Object.is(a.im, e.im)).toBe(true);
      } else {
        expect(Object.is(a, e)).toBe(true);
      }
    }
  }
}

const goldens = loadGoldens();
const byName = new Map(goldens.map((g) => [g.name, g]));

describe('P7-1 qr number path — golden Q/R', () => {
  for (const name of [
    '2x2',
    '8x8',
    '20x60',
    '60x20',
    'singular24',
    'edge16',
    'resumeNaN',
  ] as const) {
    it(`${name}: bit-exact Q and R`, () => {
      const g = byName.get(name);
      expect(g).toBeDefined();
      const { Q, R } = qr(g!.A) as { Q: unknown[][]; R: unknown[][] };
      expectMatrixBitExact(Q, g!.Q);
      expectMatrixBitExact(R, g!.R);
    });
  }

  it('complex8: bit-exact Q and R on Complex input', () => {
    const g = byName.get('complex8');
    expect(g).toBeDefined();
    const A = g!.A.map((row) =>
      row.map((cell) => {
        const c = cell as { re: number; im: number };
        return new Complex(c.re, c.im);
      })
    );
    const { Q, R } = qr(A) as { Q: unknown[][]; R: unknown[][] };
    expectMatrixBitExact(Q, g!.Q);
    expectMatrixBitExact(R, g!.R);
  });
});

describe('P7-1 qr number path — regressions', () => {
  it('Fraction matrix keeps the pre-change throw', () => {
    expect(() =>
      qr([
        [new Fraction(1, 2), 1],
        [2, 3],
      ])
    ).toThrow();
  });
});
