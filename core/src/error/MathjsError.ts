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
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, MathjsError);
    }
  }
}
