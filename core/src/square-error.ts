/**
 * The error of a matrix that is not square.
 *
 * Every function that needs a square matrix throws this error. The class is `RangeError`, as in
 * mathjs (`Matrix must be square (size: [2, 3])`), and it is decided here only, so the same rule
 * gives the same class at every site. `RangeError` is a subclass of `Error`, so a caller that
 * catches `Error` still catches it.
 *
 * Make the message only on the failing branch:
 * `if (rows !== cols) throw notSquareError(\`lu: matrix must be square (got ${rows}×${cols})\`);`
 *
 * @param message - The text of the error.
 * @returns A `RangeError` with the text.
 */
export function notSquareError(message: string): RangeError {
  return new RangeError(message);
}
