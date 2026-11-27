/** Remap evaluate errors to mathjs 15.3.0 security-test messages (#1777). */
export function remapMathjsSandboxEvaluateError(error: unknown): never {
  if (error instanceof Error) {
    if (/Index must be an integer/.test(error.message)) {
      if (/\(value: \[object Object\]\)/.test(error.message)) {
        throw new Error('Array expected for index');
      }
    }
    if (
      error instanceof TypeError &&
      /Unexpected type of argument in function subset/.test(error.message) &&
      /actual: any/.test(error.message)
    ) {
      throw new TypeError(error.message.replace('actual: any', 'actual: Object'));
    }
  }
  throw error;
}
