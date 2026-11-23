/**
 * Dogfood #964 - runtime gaps behind the `unknown` rest overloads of the statistics and FFT
 * functions.
 *
 * - `mode` of a Matrix inside the variadic list threw the false message "array containing NaN
 *   values" (`mode(matrix, 0)`, `mode(1, matrix)`, `mode(matrix, matrix)`). A Matrix is no value of
 *   the list, so it is a `TypeError` that names the type, as `mad` does.
 * - `mode(array, 0)` and `mad(array, 0)` are mathjs 15.2.0 behaviour: they take no dimension, and an
 *   extra argument is a value of the list. The values stay (parity pins). Only the public type
 *   refuses the call.
 * - `parallelFFT`, `parallelConv`, `parallelXCorr` and `parallelAutoCorr` wrote the entries of an
 *   Array into a `Float64Array`, which turns an entry that has no numeric reading into NaN or reads
 *   `[[1]]` as 1. They now throw a `TypeError` for an Array, a typed array, an object or a string
 *   that has no numeric reading. A BigNumber and a numeric string still convert (#1042).
 */
import { describe, expect, it } from 'vitest';
import {
  bignumber,
  dct,
  dst,
  fraction,
  hilbertTransform,
  mad,
  matrix,
  median,
  mode,
  newtonInterp,
  parallelAutoCorr,
  parallelConv,
  parallelFFT,
  parallelXCorr,
  polyFit,
  polymul,
} from '../src/index.js';
import { toSamples } from '../src/utils/samples.js';

type Loose = (...args: unknown[]) => unknown;
const loose = (f: unknown): Loose => f as Loose;

/** The result of a call, or the error that it threw or rejected with. */
async function outcome(f: () => unknown): Promise<unknown> {
  try {
    return await f();
  } catch (e) {
    return e;
  }
}

describe('#964 mode of a Matrix in the variadic list', () => {
  const m = (): unknown =>
    matrix([
      [1, 2],
      [3, 4],
    ] as never);
  it.each([
    ['mode(matrix, 0)', () => loose(mode)(m(), 0)],
    ['mode(1, matrix)', () => loose(mode)(1, matrix([1, 2] as never))],
    ['mode(matrix, matrix)', () => loose(mode)(matrix([1, 2] as never), matrix([2, 3] as never))],
  ])('%s throws a TypeError that names the type (the false NaN message before)', (_name, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/Cannot calculate mode, unexpected type of argument \(type: DenseMatrix/);
    expect(call).not.toThrow(/NaN/);
  });
  it('GUARD: a Matrix alone still works, and a real NaN value still throws', () => {
    expect(
      mode(
        matrix([
          [1, 2],
          [2, 4],
        ] as never) as never
      )
    ).toEqual([2]);
    expect(() => loose(mode)(1, NaN)).toThrow(/NaN/);
  });
});

describe('#964 mode and mad of an array and a number: mathjs 15.2.0 parity', () => {
  // mathjs mode and mad take no dimension: the extra argument is one more value of the list.
  // The public type refuses this call, so the pins go through a loose handle.
  it('mode([[1, 2], [3, 4]], 0) is [1, 2, 3, 4, 0]', () => {
    expect(
      loose(mode)(
        [
          [1, 2],
          [3, 4],
        ],
        0
      )
    ).toEqual([1, 2, 3, 4, 0]);
  });
  it('mad([[1, 2], [3, 4]], 0) is 1', () => {
    expect(
      loose(mad)(
        [
          [1, 2],
          [3, 4],
        ],
        0
      )
    ).toBe(1);
  });
  it('mad(matrix, 0) throws the TypeError of mathjs', () => {
    expect(() =>
      loose(mad)(
        matrix([
          [1, 2],
          [3, 4],
        ] as never),
        0
      )
    ).toThrow(TypeError);
  });
});

describe('#964 the parallel signal functions reject an entry with no numeric reading', () => {
  it.each([
    [
      'parallelFFT([[1, 2], [3, 4]])',
      () =>
        loose(parallelFFT)([
          [1, 2],
          [3, 4],
        ]),
    ],
    ['parallelFFT(["a", "b"])', () => loose(parallelFFT)(['a', 'b'])],
    ['parallelFFT([{}, 1])', () => loose(parallelFFT)([{}, 1])],
    ['parallelConv([[1]], [1])', () => loose(parallelConv)([[1]], [1])],
    ['parallelConv([1, 2], [[1]])', () => loose(parallelConv)([1, 2], [[1]])],
    ['parallelXCorr([[1]], [1])', () => loose(parallelXCorr)([[1]], [1])],
    ['parallelAutoCorr([[1]])', () => loose(parallelAutoCorr)([[1]])],
  ])('%s throws a TypeError (NaN bins, or [1], [1, 2], [1], [1] before)', async (_name, call) => {
    const e = await outcome(call);
    expect(e).toBeInstanceOf(TypeError);
    expect((e as Error).message).toMatch(/expects number data, got a/);
  });
  it('the message names the function, the type and the index', async () => {
    const e = await outcome(() => loose(parallelFFT)([1, [2]]));
    expect((e as Error).message).toBe('parallelFFT: expects number data, got a Array at index 1');
  });
  it('GUARD (#1042): a BigNumber and a numeric string still convert', () => {
    const viaBig = parallelFFT([bignumber(1), bignumber(2)] as never);
    expect(Array.from(viaBig.real)).toEqual([3, -1]);
    const viaString = parallelFFT(['1', '2'] as never);
    expect(Array.from(viaString.real)).toEqual([3, -1]);
  });
  it('GUARD: valid number data keeps its present result', async () => {
    const r = parallelFFT([1, 2, 3, 4]);
    expect(Array.from(r.real)).toEqual([10, -2, -2, -1.9999999999999998]);
    expect(Array.from(r.imag)).toEqual([0, 2, 0, -2]);
    expect(r.originalLength).toBe(4);
    expect(await parallelConv([1, 2], [1, 1])).toEqual(new Float64Array([1, 3, 2]));
  });
});

describe('#964 the same defect in the other callers of toSamples', () => {
  // The copy of an Array into a Float64Array is in `toSamples`, so the fix is there. Before it,
  // dct and polymul gave NaN, dst read [[1]] as 1 (1.414...), and polyFit read [0] as 0.
  it.each([
    [
      'dct',
      () =>
        loose(dct)([
          [1, 2],
          [3, 4],
        ]),
    ],
    ['dst', () => loose(dst)([[1]])],
    [
      'hilbertTransform',
      () =>
        loose(hilbertTransform)([
          [1, 2],
          [3, 4],
        ]),
    ],
    ['polymul', () => loose(polymul)([[1, 2]], [1, 1])],
    ['newtonInterp', () => loose(newtonInterp)([[0], 1, 2], [0, 1, 4])],
    ['polyFit', () => loose(polyFit)([[0], 1, 2], [0, 1, 4], 1)],
  ])('%s throws a TypeError for a nested Array entry', (name, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(new RegExp(`${name}: expects number data, got a Array at index 0`));
  });
  it('toSamples reads a number, a BigNumber, a Fraction and a numeric string as before', () => {
    const v = toSamples('t', [1.5, NaN, bignumber(2), fraction(1, 2), '3', true, null]);
    expect(Array.from(v)).toEqual([1.5, NaN, 2, 0.5, 3, 1, 0]);
  });
  it('toSamples throws for an object, a string that is no number and undefined', () => {
    expect(() => toSamples('t', [{}])).toThrow(/t: expects number data, got a Object at index 0/);
    expect(() => toSamples('t', ['x'])).toThrow(/t: expects number data, got a string at index 0/);
    expect(() => toSamples('t', [1, undefined])).toThrow(/got a undefined at index 1/);
    expect(() => toSamples('t', [[]])).toThrow(/got a Array at index 0/);
  });
  it('toSamples keeps the Float64Array reading of an empty string, a blank, true and null', () => {
    // The engine reads '' and ' ' as 0, true as 1 and null as 0, as mathjs number() does (#977).
    expect(Array.from(toSamples('t', [1, '', ' ', true, null]))).toEqual([1, 0, 0, 1, 0]);
  });
  it('toSamples throws for a column vector [[1], [3], [5]] (it read as [1, 3, 5])', () => {
    expect(() => toSamples('t', [[1], [3], [5]])).toThrow(
      /t: expects number data, got a Array at index 0/
    );
    expect(() => dct([[1], [3], [5]] as never)).toThrow(TypeError);
  });
  it('GUARD: dct of a number array and of a BigNumber array keep their values', () => {
    expect(dct([1, 2])).toEqual(dct([bignumber(1), bignumber(2)] as never));
  });
});

describe('#964 regression pins for items that main already fixed', () => {
  it('median of a Fraction matrix is the Fraction 3/2', () => {
    const v = median(matrix([fraction(1, 2), fraction(5, 2), fraction(3, 2)] as never) as never);
    expect(String(v)).toBe('1.5');
    expect((v as { constructor: { name: string } }).constructor.name).toBe('Fraction');
  });
});
