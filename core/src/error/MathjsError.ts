/**
 * Custom error type for Mathjs errors
 * @extends Error
 */
export class MathjsError extends Error {
  isMathjsError = true as const;

  /**
   * Create a MathjsError
   * @param message  Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'MathjsError';

    // Maintains proper stack trace for where error was thrown (V8). The
    // captureStackTrace static is non-standard (V8 only), so reach it through
    // a narrow structural cast rather than assuming it on ErrorConstructor.
    const errorCtor = Error as unknown as {
      captureStackTrace?(
        targetObject: object,
        constructorOpt?: abstract new (...args: never[]) => unknown
      ): void;
    };
    if (errorCtor.captureStackTrace) {
      errorCtor.captureStackTrace(this, MathjsError);
    }
  }
}
