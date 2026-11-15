import { describe, expect, it } from 'vitest';
import { BigNumber, Complex, Fraction } from '@danielsimonjr/mathts-core';
import { evaluate, inv, matrix, multiply, pinv } from '../src/index.js';

const str = (m: unknown[][]) => m.map((r) => r.map(String));

describe('#1040 pinv of a matrix with a Complex entry', () => {
  it('returns the pseudo-inverse', () => {
    const r = pinv([
      [new Complex(1, 1), 0],
      [0, 2],
    ] as never) as unknown as unknown[][];
    expect(str(r)).toEqual([
      ['0.5 - 0.5i', '0'],
      ['0', '0.5'],
    ]);
  });

  it('handles a full-column-rank non-square Complex matrix', () => {
    // A = [1, i]^T has pinv = A^H / (A^H A) = [1, -i] / 2.
    const r = pinv([[new Complex(1, 0)], [new Complex(0, 1)]] as never) as unknown as unknown[][];
    expect(str(r)).toEqual([['0.5', '-0.5i']]);
  });

  it('keeps the real SVD path for a number matrix', () => {
    expect(
      pinv([
        [2, 0],
        [0, 4],
      ])
    ).toEqual([
      [0.5, 0],
      [0, 0.25],
    ]);
  });

  it('rejects rcond for a Complex matrix instead of ignoring it', () => {
    expect(() =>
      pinv(
        [
          [new Complex(1, 1), 0],
          [0, 2],
        ] as never,
        { rcond: 1e-6 }
      )
    ).toThrow(TypeError);
  });
});

describe('#1040 root cause: the dense matrix product of non-number entries', () => {
  it('multiplies Complex 2-D arrays', () => {
    const r = multiply(
      [
        [new Complex(1, 1), 0],
        [0, 2],
      ] as never,
      [
        [1, 0],
        [0, new Complex(0, 1)],
      ] as never
    ) as unknown as unknown[][];
    expect(str(r)).toEqual([
      ['1 + i', '0'],
      ['0', '2i'],
    ]);
  });

  it('reports a shape mismatch the same way as the number path', () => {
    expect(() => multiply([[new Complex(1, 1), 2]] as never, [[1, 2]] as never)).toThrow(
      'Cannot multiply 1×2 matrix with 1×2 matrix'
    );
  });

  it('keeps a number product on the numeric backend', () => {
    expect(
      multiply(
        [
          [1, 2],
          [3, 4],
        ],
        [[5], [6]]
      )
    ).toEqual([[17], [39]]);
  });
});

describe('#1040 inv detects a singular matrix of non-number entries', () => {
  const singular2 = [
    [1, new Complex(0, 1)],
    [1, new Complex(0, 1)],
  ];
  it('throws for a singular 2x2 Complex matrix instead of returning NaN', () => {
    expect(() => inv(singular2 as never)).toThrow('Cannot calculate inverse, determinant is zero');
  });

  it('throws for a singular 3x3 Complex matrix', () => {
    const z = new Complex(0, 0);
    expect(() =>
      inv([
        [new Complex(1, 1), 0, 0],
        [0, z, 0],
        [0, 0, 1],
      ] as never)
    ).toThrow('Cannot calculate inverse, determinant is zero');
  });

  it('pinv of a rank-deficient Complex matrix satisfies A·A⁺·A = A', () => {
    // A = [1, 1]^T [1, i], so A⁺ = A^H / ‖A‖²_F = [[1, 1], [-i, -i]] / 4.
    const p = pinv(singular2 as never) as unknown as unknown[][];
    expect(str(p)).toEqual([
      ['0.25', '0.25'],
      ['-0.25i', '-0.25i'],
    ]);
    const back = multiply(
      multiply(singular2 as never, p as never) as never,
      singular2 as never
    ) as unknown as unknown[][];
    expect(str(back)).toEqual(str(singular2));
  });
});

describe('#1040 the other inputs of the same paths', () => {
  const C = new Complex(1, 1);
  it('pinv of a boxed Complex matrix returns a boxed matrix', () => {
    const r = pinv(
      matrix([
        [C, 0],
        [0, 2],
      ] as never) as never
    ) as unknown as { toArray(): unknown[][] };
    expect(str(r.toArray())).toEqual([
      ['0.5 - 0.5i', '0'],
      ['0', '0.5'],
    ]);
  });

  it('evaluate reaches the same pinv', () => {
    expect(str(evaluate('pinv([[1+i, 0], [0, 2]])') as unknown as unknown[][])).toEqual([
      ['0.5 - 0.5i', '0'],
      ['0', '0.5'],
    ]);
  });

  it('multiplies two boxed Complex matrices', () => {
    const r = multiply(
      matrix([
        [C, 0],
        [0, 2],
      ] as never),
      matrix([
        [1, 0],
        [0, C],
      ] as never)
    ) as unknown as { toArray(): unknown[][] };
    expect(str(r.toArray())).toEqual([
      ['1 + i', '0'],
      ['0', '2 + 2i'],
    ]);
  });

  it('multiplies Fraction and BigNumber matrices exactly', () => {
    const f = multiply(
      [[new Fraction(1, 2)]] as never,
      [[new Fraction(1, 3)]] as never
    ) as unknown as unknown[][];
    expect(f[0][0]).toBeInstanceOf(Fraction);
    expect((f[0][0] as Fraction).equals(new Fraction(1, 6))).toBe(true);
    const b = multiply(
      [[new BigNumber(2)]] as never,
      [[new BigNumber(3)]] as never
    ) as unknown as unknown[][];
    expect(String(b[0][0])).toBe('6');
  });

  it('rejects a ragged Complex matrix with the message of the number path', () => {
    expect(() => multiply([[C, 1], [2]] as never, [[1], [2]] as never)).toThrow(
      'DenseMatrix nested array must be rectangular; row 1 has length 1, expected 2'
    );
  });

  it('rejects a string entry, as mathjs does', () => {
    expect(() => multiply([['a']] as never, [[2]] as never)).toThrow();
  });
});
