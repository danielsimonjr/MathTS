import { describe, expect, it } from 'vitest';
import { qr as mathjsQr } from 'mathjs';
import { lu } from '@danielsimonjr/mathts-matrix';
import { matrix, qr, qrPivoted, svd } from '../src/index.js';

function factorValues(value: unknown) {
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry !== 'function')
      .map(([key, entry]) => [
        key,
        typeof (entry as { toArray?: unknown } | null)?.toArray === 'function'
          ? (entry as { toArray(): unknown }).toArray()
          : entry,
      ])
  );
}

describe('missing entries in decomposition inputs', () => {
  it.each([
    ['QR', qr],
    ['pivoted QR', qrPivoted],
    ['LU', (a: unknown) => lu(a as number[][])],
    ['SVD', svd],
    ['boxed QR', (a: unknown) => qr(matrix(a as number[][]))],
  ] as const)('%s reads null and undefined as zero', (_name, factor) => {
    const expected = factor([
      [0, 1],
      [2, 0],
    ]);
    for (const missing of [null, undefined]) {
      const input = [
        [missing, 1],
        [2, missing],
      ];
      const result = (factor as (value: unknown) => unknown)(input);
      expect(factorValues(result)).toEqual(factorValues(expected));
      expect(input[0][0]).toBe(missing);
    }
  });

  it('keeps the MathTS zero-entry convention where mathjs rejects QR input', () => {
    for (const missing of [null, undefined]) {
      expect(() =>
        mathjsQr([
          [missing, 1],
          [2, 0],
        ] as number[][])
      ).toThrow(TypeError);
      expect(() =>
        qr([
          [missing, 1],
          [2, 0],
        ])
      ).not.toThrow();
    }
  });
});
