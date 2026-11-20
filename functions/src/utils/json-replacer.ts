/**
 * `JSON.stringify` replacer that preserves non-finite numbers and bigint values, with the tags
 * of mathjs. `Complex` and `Fraction` already serialize via their own `toJSON()`.
 */
export function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number') {
    if (value === Infinity) return { mathjs: 'number', value: 'Infinity' };
    if (value === -Infinity) return { mathjs: 'number', value: '-Infinity' };
    if (Number.isNaN(value)) return { mathjs: 'number', value: 'NaN' };
  }
  if (typeof value === 'bigint') return { mathjs: 'bigint', value: String(value) };
  return value;
}
