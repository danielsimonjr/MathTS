import { isComplex, isFraction, Unit } from '@danielsimonjr/mathts-core';
import { isPlainObject, isSafeProperty, setSafeProperty } from './customs.js';

const RETURNABLE_OBJECT_MARKERS = new Set([
  'Complex',
  'Fraction',
  'Unit',
  'DenseMatrix',
  'SparseMatrix',
  'BigNumber',
  'Tensor',
  'Chain',
  'MathJSDenseMatrix',
]);

function isAllowedObject(value: object): boolean {
  if (Array.isArray(value)) return true;
  if (isPlainObject(value)) return true;
  if (isComplex(value) || isFraction(value)) return true;
  try {
    if (value instanceof Unit) return true;
  } catch {
    // ignore
  }
  const tagged = value as { type?: unknown; mathjs?: unknown; constructor?: { name?: string } };
  if (typeof tagged.type === 'string' && RETURNABLE_OBJECT_MARKERS.has(tagged.type)) return true;
  if (typeof tagged.mathjs === 'string' && RETURNABLE_OBJECT_MARKERS.has(tagged.mathjs))
    return true;
  const name = tagged.constructor?.name;
  if (name && RETURNABLE_OBJECT_MARKERS.has(name)) return true;
  return false;
}

function isHostReturnValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string' || t === 'bigint') return false;
  if (t === 'function' || t === 'symbol') return true;
  if (t !== 'object') return true;
  if (isAllowedObject(value)) return false;
  return true;
}

/**
 * Refuse to return host objects (e.g. scope-injected `process`) from safe evaluate.
 * Clones plain objects/arrays so nested host references cannot leak.
 */
export function sanitizeEvaluateResult(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (isHostReturnValue(value)) {
    throw new Error(
      'Security: evaluate cannot return a host object. Scope values are not exfiltrated by identity.'
    );
  }
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string' || t === 'bigint') return value;
  if (t !== 'object') return value;

  if (isComplex(value) || isFraction(value)) return value;
  try {
    if (value instanceof Unit) return value;
  } catch {
    // Unit may be undefined in some browser builds
  }
  if (!isAllowedObject(value)) {
    throw new Error(
      'Security: evaluate cannot return a host object. Scope values are not exfiltrated by identity.'
    );
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    return value.map((entry) => sanitizeEvaluateResult(entry, seen));
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (!isSafeProperty(out, key)) continue;
      setSafeProperty(
        out,
        key,
        sanitizeEvaluateResult((value as Record<string, unknown>)[key], seen)
      );
    }
    return out;
  }

  return value;
}
