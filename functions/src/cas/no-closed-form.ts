/**
 * The error of a CAS transform that has no rule for its input.
 */

/**
 * Thrown by `laplace` and `inverseLaplace` when the input is outside their rules. The message
 * names the function and the input. The functions throw it in place of a marker text such as
 * `L{t*sin(t)}(s)`, because that text does not parse.
 */
export class NoClosedFormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoClosedFormError';
  }
}
