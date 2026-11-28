/**
 * mathjs 15.3.0 statistics error wording for compat (#1786).
 */

type TypedError = Error & { data?: { actual?: string } };

function valueTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'Array';
  if (typeof value === 'object') {
    const name = (value as { constructor?: { name?: string } }).constructor?.name;
    return typeof name === 'string' && name.length > 0 ? name : 'Object';
  }
  return typeof value;
}

/** Mirrors mathjs `improveErrorMessage` for `std` / `variance` transform tests. */
export function improveMathjsStatisticsError(
  err: unknown,
  fnName: 'std' | 'variance',
  value?: unknown
): Error {
  const e = err as TypedError;
  const errText = String(err);
  if (/add: unexpected type null/i.test(errText)) {
    return new TypeError(
      `Cannot calculate ${fnName}, unexpected type of argument (type: null, value: null)`
    );
  }
  if (errText.includes('Unexpected type')) {
    const details =
      value !== undefined
        ? ` (type: ${valueTypeLabel(value)}, value: ${JSON.stringify(value)})`
        : ` (type: ${e.data?.actual ?? 'unknown'})`;
    return new TypeError(`Cannot calculate ${fnName}, unexpected type of argument${details}`);
  }
  if (String(err).includes('complex numbers')) {
    const details =
      value !== undefined
        ? ` (type: ${valueTypeLabel(value)}, value: ${JSON.stringify(value)})`
        : '';
    return new TypeError(
      `Cannot calculate ${fnName}, no ordering relation is defined for complex numbers${details}`
    );
  }
  if (err instanceof Error && /DimensionMismatch|different dimensions/i.test(err.message)) {
    return new Error('Units do not match');
  }
  return err instanceof Error ? err : new Error(String(err));
}
