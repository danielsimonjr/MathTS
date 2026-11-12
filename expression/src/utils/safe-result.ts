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

function isDisallowedHostObject(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  return !isAllowedObject(value);
}

/** Block returning a caller scope binding by reference (#816), not math exports like `min`. */
function isExfiltratedScopeBinding(value: unknown, scope?: Record<string, unknown>): boolean {
  if (!scope || value === undefined || value === null) return false;
  for (const key of Object.keys(scope)) {
    if (scope[key] !== value) continue;
    if (typeof value === 'function') {
      return typeof process !== 'undefined' && (value as unknown) === (process as unknown);
    }
    return isDisallowedHostObject(value);
  }
  return false;
}

/**
 * Refuse to return host objects (e.g. scope-injected `process`) from safe evaluate.
 * Clones plain objects/arrays so nested host references cannot leak.
 */
export function sanitizeEvaluateResult(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  scope?: Record<string, unknown>
): unknown {
  if (isExfiltratedScopeBinding(value, scope)) {
    throw new Error(
      'Security: evaluate cannot return a host object. Scope values are not exfiltrated by identity.'
    );
  }
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string' || t === 'bigint') return value;
  if (t === 'function' || t === 'symbol') return value;
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
    return value.map((entry) => sanitizeEvaluateResult(entry, seen, scope));
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
        sanitizeEvaluateResult((value as Record<string, unknown>)[key], seen, scope)
      );
    }
    return out;
  }

  return value;
}
