/**
 * Custom error type for index out of range errors.
 *
 * The single canonical `IndexError` for the whole monorepo (Bucket B, commit 1),
 * exposed via the `@danielsimonjr/mathts-core/internal` subpath. `expression/src/error/
 * IndexError.ts` and `functions/src/error/IndexError.ts` are now thin re-export shims
 * of this class — an `IndexError` thrown in one package is `instanceof IndexError`
 * in any other, since there is only ever one class identity. `core/src/array.ts` /
 * `core/src/collection.ts` (and the many other call sites across concat, subset,
 * cumsum, mapSlices, ...) all throw this same class.
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

// Back-compat factory form (originated in functions/src/error/IndexError.ts) —
// allows constructing an IndexError without `new`.
export function createIndexError(index: number, min?: number, max?: number): IndexError {
  return new IndexError(index, min, max);
}
