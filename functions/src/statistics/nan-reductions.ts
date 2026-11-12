import { median } from '../factories/index.js';
import { finiteNumbers, reduceNumericMatrix, type NumericVectorInput } from './numeric-data.js';

/** `median` with NaN omitted (`numpy.nanmedian`). A `dim` reduces along that axis. */
export function nanmedian(x: NumericVectorInput | number[][], dim?: number): number | number[] {
  if (dim === undefined) {
    const data = finiteNumbers(x as ArrayLike<number>, true);
    if (data.length === 0) return NaN;
    return median(data) as number;
  }
  return reduceNumericMatrix(x, dim, true, (xs) => {
    const data = finiteNumbers(xs, true);
    if (data.length === 0) return NaN;
    return median(data) as number;
  }) as number | number[];
}
