/**
 * Create a range error with the message:
 *     'Dimension mismatch (<actual size> != <expected size>)'
 * Or with a custom message when called with a single string argument.
 *
 * NOT part of the Bucket-B dedup surface (yet) — `expression/src/error/DimensionError.ts`
 * and `functions/src/error/DimensionError.ts` remain the packages' own canonical
 * copies, used by ~20 other call sites beyond array (matrix algos, subset, resize,
 * concat, reshape, ...). This copy exists ONLY as a same-behavior internal
 * implementation detail so `core/src/array.ts` (the Bucket B slice 2 canonical) can
 * throw a correctly-shaped (`isDimensionError: true`) error without reaching back
 * into either package. Consumers only ever duck-type on `e.isDimensionError` or
 * `instanceof DimensionError` WITHIN THE SAME FILE (array.ts's own `reshape` catches
 * its own `_reshape`'s thrown `DimensionError` by reference to this same class), so
 * a distinct class identity here is safe.
 */
export class DimensionError extends RangeError {
  actual?: number | number[];
  expected?: number | number[];
  relation?: string;
  isDimensionError = true as const;

  /**
   * @param actual - The actual size or custom error message
   * @param expected - The expected size (optional if actual is a custom message)
   * @param relation - Optional relation between actual and expected size: '!=', '<', etc.
   */
  constructor(actual: number | number[] | string, expected?: number | number[], relation?: string) {
    let message: string;

    // Support custom message: new DimensionError('custom message')
    if (typeof actual === 'string' && expected === undefined) {
      message = actual;
    } else {
      // Standard usage: new DimensionError(actual, expected, relation)
      message =
        'Dimension mismatch (' +
        (Array.isArray(actual) ? '[' + actual.join(', ') + ']' : actual) +
        ' ' +
        (relation || '!=') +
        ' ' +
        (Array.isArray(expected) ? '[' + expected.join(', ') + ']' : expected) +
        ')';
    }

    super(message);

    this.name = 'DimensionError';

    // Only set actual/expected/relation if not using custom message
    if (typeof actual === 'string' && expected === undefined) {
      this.actual = undefined;
      this.expected = undefined;
      this.relation = undefined;
    } else {
      this.actual = actual as number | number[];
      this.expected = expected;
      this.relation = relation;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    const ErrorWithCapture = Error as unknown as {
      captureStackTrace?(targetObject: object, constructorOpt?: unknown): void;
    };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, DimensionError);
    }
  }
}
