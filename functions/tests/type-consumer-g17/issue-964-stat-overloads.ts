/** Dogfood #964: the public overloads of median, mode and mad. */
import { create, all } from '@danielsimonjr/mathts-compat';
import type { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import {
  bignumber,
  mad,
  matrix,
  mean,
  median,
  mode,
  sparse,
  std,
  variance,
} from '@danielsimonjr/mathts-functions';
import type { BridgeMatrix } from '@danielsimonjr/mathts-functions';
import type { DenseMatrix } from '@danielsimonjr/mathts-matrix';

declare const ro: readonly number[];
declare const ro2: readonly (readonly number[])[];
declare const dense: DenseMatrix;
declare const anything: readonly unknown[];
// `fraction` still returns `unknown` in the public types (#1359), so the exact scalar is declared.
declare const fr: Fraction;
// `bignumber` and `matrix` return their own kind: a scalar gives a BigNumber, `matrix` and `sparse`
// give the bridge matrix (the run time class is not the matrix-package DenseMatrix).
const bn: BigNumber = bignumber(1);
const bm: BridgeMatrix = matrix([
  [1, 2],
  [3, 4],
]);
const sm: BridgeMatrix = sparse([
  [1, 0],
  [0, 4],
]);

// A readonly array resolved to `unknown` before, because the collection overloads took a mutable one.
const a: number = median(ro);
const b: number[] | number = mode(ro);
const c: number = mad(ro);
const a2: number = median(ro2);
const d: number = median(dense);
const dim: number | number[] = median(ro2, 0);

// A list of scalars keeps its type.
const e: number = median(1, 2, 3);
const f: number[] = mode(1, 2, 2);
const g: number = mad(1, 2, 3);
const h: BigNumber = median(bn, bn);
const i: Fraction = mad(fr, fr);
const j: BigNumber[] = mode(bn, bn);

// A collection of unknown elements (a compat matrix, a list of Units) still compiles.
const k: unknown = median(anything);
const l: unknown = mode(anything);
const m: unknown = mad(anything);

// @ts-expect-error median of a string is no call
median('x');

// @ts-expect-error median of an object is no call
median({});

// @ts-expect-error median needs a value
median();

// @ts-expect-error mad needs a value
mad();

// @ts-expect-error mode needs a value
mode();

// @ts-expect-error mode takes no dimension: the run time reads the 0 as one more value (as mathjs does)
mode([[1, 2]], 0);

// A matrix from `matrix()` or `sparse()` is an argument of each statistic, as a DenseMatrix is.
const n1: unknown = median(bm);
const n2: unknown = mode(bm);
const n3: unknown = mad(sm);
const n4: unknown = mean(bm);
const n5: unknown = variance(bm);
const n6: unknown = std(sm);
const n7: unknown = std(bm, 'uncorrected');
const n8: unknown = median(bignumber([1, 2, 3]) as readonly unknown[]);

// Scalars from the constructors: no declared value is needed.
const o1: BigNumber = median(bignumber(1), bignumber(2));
const o2: BigNumber = mad(bignumber(1), bignumber(2));
const o3: BigNumber[] = mode(bignumber(1), bignumber(2));

// The run-time list forms of `mode` with strings and mixed scalars (its documented examples).
const p1: (number | string)[] = mode('a', 'a', 'b', 'c');
const p2: (number | string)[] = mode(1, 1.5, 'abc');

// The compat instance takes the compat matrix in the same calls.
const math = create(all);
const q1: unknown = math.median(math.matrix([1, 2, 3]));
const q2: unknown = math.mode(math.matrix([1, 2, 3]));
const q3: unknown = math.mad(math.matrix([1, 2, 3]));
const q4: unknown = math.std(math.matrix([1, 2, 3]));
const q5: unknown = math.variance(
  math.matrix([
    [1, 2],
    [3, 4],
  ]),
  'uncorrected'
);
const q6: unknown = math.mean(math.matrix([1, 2, 3]));
const q7: unknown = math.median(math.bignumber(1), math.bignumber(2));

// @ts-expect-error an object without the `isMatrix` flag is no matrix
median({ toArray: () => [1, 2] });

export { a, a2, b, c, d, dim, e, f, g, h, i, j, k, l, m };
export { n1, n2, n3, n4, n5, n6, n7, n8, o1, o2, o3, p1, p2, q1, q2, q3, q4, q5, q6, q7 };
