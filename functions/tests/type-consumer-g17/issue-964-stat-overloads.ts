/** Dogfood #964: the public overloads of median, mode and mad. */
import type { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { mad, median, mode } from '@danielsimonjr/mathts-functions';
import type { DenseMatrix } from '@danielsimonjr/mathts-matrix';

declare const ro: readonly number[];
declare const ro2: readonly (readonly number[])[];
declare const dense: DenseMatrix;
declare const anything: readonly unknown[];
// The constructors `bignumber` and `fraction` return `unknown` in the public types (#1359), so the
// exact scalars are declared here.
declare const bn: BigNumber;
declare const fr: Fraction;

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

export { a, a2, b, c, d, dim, e, f, g, h, i, j, k, l, m };
