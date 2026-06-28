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

    // Maintains proper stack trace for where error was thrown (V8)
    const ErrorWithCapture = Error as unknown as {
      captureStackTrace?(targetObject: object, constructorOpt?: unknown): void;
    };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, MathjsError);
    }
  }
}
