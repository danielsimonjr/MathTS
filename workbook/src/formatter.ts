/**
 * Human-readable rendering of cell results for terminal output.
 *
 * `formatResult` is called inside the executor's continue-on-error loop, so it
 * MUST NOT throw — circular references, BigInt, and unserializable values all
 * fall back to safe markers rather than crashing the run.
 */

function bigintReplacer(_key: string, val: unknown): unknown {
  return typeof val === 'bigint' ? `${val}n` : val;
}

/**
 * JSON.stringify that never throws. Tries a plain (BigInt-aware) pass first so
 * non-cyclic shared references serialize faithfully; only a genuine circular
 * reference (which makes the first pass throw) falls back to the cycle-guarded
 * pass, where the real cycle is rendered as `[Circular]`.
 */
function safeStringify(value: unknown): string {
  try {
    const json = JSON.stringify(value, bigintReplacer);
    if (json !== undefined) return json;
  } catch {
    // genuine cycle (or other) — fall back to the guarded pass below
  }

  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return `${val}n`;
      if (val !== null && typeof val === 'object') {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
    return json ?? '(no result)';
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

/** Whether a value defines a meaningful (non-default) `toString`. */
function hasCustomToString(value: object): boolean {
  const toString = (value as { toString?: unknown }).toString;
  return (
    typeof toString === 'function' &&
    toString !== Object.prototype.toString &&
    toString !== Array.prototype.toString
  );
}

export function formatResult(value: unknown): string {
  if (value === null || value === undefined) return '(no result)';

  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'function':
      return '(function)';
    case 'symbol':
      return value.toString();
    case 'object': {
      // Class instances (Complex, Fraction, matrices, …) render via toString.
      if (!Array.isArray(value) && hasCustomToString(value)) {
        try {
          const text = (value as { toString(): string }).toString();
          if (text && text !== '[object Object]') return text;
        } catch {
          // fall through to JSON
        }
      }
      return safeStringify(value);
    }
    default:
      return safeStringify(value);
  }
}
