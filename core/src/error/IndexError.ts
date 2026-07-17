/**
 * Custom error type for index out of range errors.
 *
 * NOT part of the Bucket-B dedup surface (yet) — `expression/src/error/IndexError.ts`
 * and `functions/src/error/IndexError.ts` remain the packages' own canonical copies,
 * used by many other call sites beyond array/collection (concat, subset, cumsum,
 * mapSlices, ...). This copy exists ONLY as a same-behavior internal implementation
 * detail so `core/src/array.ts` / `core/src/collection.ts` (the Bucket B slice 2
 * canonical) can throw a correctly-shaped (`isIndexError: true`) error without
 * reaching back into either package. Consumers only ever duck-type on
 * `e.isIndexError`, never `instanceof IndexError`, so a distinct class identity
 * here is safe. See `functions/tests/dedup-bucketB-equivalence.test.ts`.
 *
 * @extends RangeError
 */
export class IndexError extends RangeError {
  index: number;
  min: number | undefined;
  max: number | undefined;
  isIndexError = true as const;

  /**
   * Create an IndexError
   *
   * Can be called in two ways:
   * - IndexError(index, max) - assumes min=0
   * - IndexError(index, min, max)
   *
   * @param index  The actual index
   * @param min    Minimum index (included), or max if only 2 args provided
   * @param max    Maximum index (excluded)
   */
  constructor(index: number, min?: number, max?: number) {
    let actualMin: number | undefined;
    let actualMax: number | undefined;

    if (max === undefined) {
      // Called with 2 args: IndexError(index, max)
      actualMin = 0;
      actualMax = min;
    } else {
      // Called with 3 args: IndexError(index, min, max)
      actualMin = min;
      actualMax = max;
    }

    let message: string;
    if (actualMin !== undefined && index < actualMin) {
      message = 'Index out of range (' + index + ' < ' + actualMin + ')';
    } else if (actualMax !== undefined && index >= actualMax) {
      message = 'Index out of range (' + index + ' > ' + (actualMax - 1) + ')';
    } else {
      message = 'Index out of range (' + index + ')';
    }

    super(message);

    this.index = index;
    this.min = actualMin;
    this.max = actualMax;
    this.name = 'IndexError';

    // Maintains proper stack trace for where error was thrown (V8)
    const ErrorWithCapture = Error as unknown as {
      captureStackTrace?(targetObject: object, constructorOpt?: unknown): void;
    };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, IndexError);
    }
  }
}
