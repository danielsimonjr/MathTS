/**
 * Custom error type for wrong number of arguments
 * @extends Error
 */
export class ArgumentsError extends Error {
  fn: string;
  count: number;
  min: number;
  max: number | undefined;
  isArgumentsError = true as const;

  /**
   * Create an ArgumentsError
   * @param fn     Function name
   * @param count  Actual argument count
   * @param min    Minimum required argument count
   * @param max    Maximum required argument count (optional)
   */
  constructor(fn: string, count: number, min: number, max?: number) {
    const message =
      'Wrong number of arguments in function ' +
      fn +
      ' (' +
      count +
      ' provided, ' +
      min +
      (max !== undefined && max !== null ? '-' + max : '') +
      ' expected)';

    super(message);

    this.fn = fn;
    this.count = count;
    this.min = min;
    this.max = max;
    this.name = 'ArgumentsError';

    // Maintains proper stack trace for where error was thrown (V8)
    const ErrorWithCapture = Error as unknown as {
      captureStackTrace?(targetObject: object, constructorOpt?: unknown): void;
    };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(this, ArgumentsError);
    }
  }
}
