import { describe, expect, it } from 'vitest';
import { bignumber, complex, lsolve, lusolve, matrix, usolve } from '../src/factories/index.js';

const scalars = {
  BigNumber: (n: number) => bignumber(`${n}e-100`),
  Complex: (n: number) => complex(0, n * 1e-100),
};

function expectSolution(result: unknown): void {
  const column = (result as { valueOf(): unknown[][] }).valueOf();
  expect(column).toHaveLength(2);
  expect(Number(String(column[0][0]))).toBeCloseTo(2, 13);
  expect(Number(String(column[1][0]))).toBeCloseTo(3, 13);
}

for (const [kind, scale] of Object.entries(scalars)) {
  describe(`small ${kind} systems (#1308)`, () => {
    it('solves lower and upper triangular systems', () => {
      expectSolution(
        lsolve(
          [
            [scale(1), 0],
            [scale(2), scale(3)],
          ],
          [scale(2), scale(13)]
        )
      );
      expectSolution(
        usolve(
          [
            [scale(1), scale(2)],
            [0, scale(3)],
          ],
          [scale(8), scale(9)]
        )
      );
    });

    it('keeps small elimination terms and swaps to the largest pivot', () => {
      const coefficients = [
        [scale(1), scale(2)],
        [scale(3), scale(4)],
      ];
      const right = [scale(8), scale(18)];
      expectSolution(lusolve(coefficients, right));
      expectSolution(lusolve(matrix(coefficients), right));
    });

    it('rejects a zero pivot with a nonzero right-hand side', () => {
      expect(() => lsolve([[0]], [scale(1)])).toThrow(/singular/);
      expect(() => lusolve([[scale(0)]], [scale(1)])).toThrow(/singular/);
    });
  });
}
