/**
 * #1050: `mean`, `variance` and `std` with an options object accept exact data. `ddof` scales the
 * sum of squared deviations by `n - ddof` (NaN when `n - ddof` is not positive), and `skipNaN` drops the
 * values that the factory `isNaN` reports. The number path gives the expected values.
 */
import { describe, expect, it } from 'vitest';
import { bignumber, fraction, matrix, mean, sqrt, std, variance } from '../src/index.js';

const bn = (x: number): unknown => bignumber(x);
const str = (x: unknown): string => String(x);
const isBig = (x: unknown): boolean => (x as { isBigNumber?: boolean })?.isBigNumber === true;

describe('#1050 options objects on exact data', () => {
  it('bigint data with skipNaN gives the result without options', () => {
    expect(variance([1n, 2n, 3n], { skipNaN: true })).toBe(variance([1n, 2n, 3n]));
    expect(mean([1n, 2n, 3n], { skipNaN: true })).toBe(mean([1n, 2n, 3n]));
  });

  it('ddof 0 and 1 match the uncorrected and unbiased normalizations', () => {
    const xs = [bn(1), bn(2)];
    const v0 = variance(xs, { ddof: 0 });
    expect(isBig(v0)).toBe(true);
    expect(str(v0)).toBe(str(variance(xs, 'uncorrected')));
    expect(str(variance(xs, { ddof: 1 }))).toBe(str(variance(xs, 'unbiased')));
  });

  it('any other ddof divides the sum of squared deviations by n - ddof', () => {
    const v = variance([bn(1), bn(2), bn(3), bn(4)], { ddof: 2 });
    expect(isBig(v)).toBe(true);
    expect(str(v)).toBe('2.5');
    expect(str(variance([fraction(1, 2), fraction(3, 2), fraction(5, 2)], { ddof: 2 }))).toBe(
      str(fraction(2))
    );
  });

  it('ddof at or above n gives NaN, as on number data', () => {
    expect(variance([1, 2], { ddof: 2 })).toBeNaN();
    expect(Number(variance([bn(1), bn(2)], { ddof: 2 }))).toBeNaN();
    expect(Number(variance([bn(1)], { ddof: 1 }))).toBeNaN();
  });

  it('skipNaN drops exact NaN values and number NaN values', () => {
    const m = mean([bn(1), bn(NaN), bn(3)], { skipNaN: true });
    expect(isBig(m)).toBe(true);
    expect(str(m)).toBe('2');
    expect(str(mean([fraction(1, 2), NaN, fraction(3, 2)], { skipNaN: true }))).toBe(
      str(fraction(1))
    );
    expect(str(variance([bn(1), bn(NaN), bn(3)], { skipNaN: true, ddof: 0 }))).toBe('1');
  });

  it('skipNaN on data that is all NaN gives NaN', () => {
    expect(Number(mean([bn(NaN)], { skipNaN: true }))).toBeNaN();
  });

  it('std is the square root of the variance with the same options', () => {
    const s = std([bn(1), bn(3)], { ddof: 0 });
    expect(isBig(s)).toBe(true);
    expect(str(s)).toBe('1');
  });

  it('the dimension form reduces each slice, and keeps the exact type', () => {
    const grid = [
      [bn(1), bn(2)],
      [bn(3), bn(5)],
    ];
    const v = variance(grid, 0, { ddof: 0 }) as unknown[];
    expect(v.map(str)).toEqual(['1', '2.25']);
    expect(v.every(isBig)).toBe(true);
    expect((mean(grid, 1, { skipNaN: true }) as unknown[]).map(str)).toEqual(['1.5', '4']);
    const withNaN = [
      [bn(1), bn(NaN)],
      [bn(3), bn(5)],
    ];
    expect((mean(withNaN, 0, { skipNaN: true }) as unknown[]).map(str)).toEqual(['2', '5']);
    expect((std(grid, 1, { ddof: 0 }) as unknown[]).map(str)).toEqual(['0.5', '1']);
  });

  it('a matrix input gives the same result as its array', () => {
    const xs = [bn(1), bn(2), bn(4)];
    // matrix() has the type unknown in the public types (#1049 follow-up). Name the input type.
    const m = matrix(xs) as Parameters<typeof variance>[0];
    expect(str(variance(m, { ddof: 0 }))).toBe(str(variance(xs, { ddof: 0 })));
    expect(str(mean(m, { skipNaN: true }))).toBe(str(mean(xs)));
  });

  it('ddof divides the exact sum of squared deviations once, with no rounding error', () => {
    // A recomposition (uncorrected * n / (n - ddof)) leaves 1e-63 on 64-digit BigNumbers here.
    expect(str(variance([0, 2, 4].map(bn), { ddof: 2 }))).toBe('8');
    const seven = [0, 0, 0, 1, 1, 2, 3];
    expect(str(variance(seven.map(bn), { ddof: 5 }))).toBe('4');
    expect(str(variance(seven.map(bn), { ddof: 6 }))).toBe('8');
    expect(
      str(
        variance(
          seven.map((x) => fraction(x)),
          { ddof: 6 }
        )
      )
    ).toBe(str(fraction(8)));
    expect(str(std([0, 2, 4].map(bn), { ddof: 2 }))).toBe(str(sqrt(bn(8) as number)));
  });

  it('std with ddof at or above n gives NaN', () => {
    expect(Number(std([bn(1), bn(2)], { ddof: 2 }))).toBeNaN();
  });

  it('the dimension form reduces 3-D data along each axis, and takes a BigNumber dimension', () => {
    const cube = [
      [
        [bn(1), bn(2)],
        [bn(3), bn(4)],
      ],
      [
        [bn(5), bn(6)],
        [bn(7), bn(9)],
      ],
    ];
    const asNumbers = (x: unknown): unknown =>
      Array.isArray(x) ? x.map(asNumbers) : Number(String(x));
    const numCube = asNumbers(cube) as number[][][];
    for (const dim of [0, 1, 2]) {
      expect(asNumbers(variance(cube, dim, { ddof: 0 }))).toEqual(
        variance(numCube, dim, { ddof: 0 })
      );
    }
    expect(
      (mean(cube, bignumber(2) as never, { skipNaN: true }) as unknown[][]).flat().map(str)
    ).toEqual(['1.5', '3.5', '5.5', '8']);
  });

  it('an options object with no known key still throws', () => {
    expect(() => variance([bn(1), bn(2)], { foo: 1 } as never)).toThrow(TypeError);
  });
});
