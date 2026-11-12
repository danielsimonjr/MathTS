import { median } from '../factories/index.js';
import { finiteNumbers, type NumericVectorInput } from './numeric-data.js';

/** `median` with non-finite values omitted (`numpy.nanmedian`). */
export function nanmedian(x: NumericVectorInput): number {
  const data = finiteNumbers(x, true);
  if (data.length === 0) return NaN;
  return median(data) as number;
}
