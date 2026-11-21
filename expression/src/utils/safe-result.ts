import { isBigNumber, isComplex, isFraction, isMatrix, isResultSet, isUnit } from './is.js';
import { isPlainObject, isSafeProperty, setSafeProperty } from './customs.js';

/**
 * Functions copied onto the math namespace (`sin`, `min`, …). Safe evaluate may
 * return these by identity. Every other native function is a host capability
 * (`Function`, `eval`, `process.binding`).
 */
export function trustedMathFunctions(math: Record<string, unknown>): Set<unknown> {
  const trusted = new Set<unknown>();
  for (const key of Object.keys(math)) {
    const value = math[key];
    if (typeof value === 'function') trusted.add(value);
  }
  return trusted;
}

function isNativeFunction(value: unknown): boolean {
  if (typeof value !== 'function') return false;
  try {
    return Function.prototype.toString.call(value).includes('[native code]');
  } catch {
    return true;
  }
}

function isGlobalFunction(value: Function): boolean {
  if (value === Function.prototype) return true;
  const name = value.name;
  if (!name) return false;
  try {
    return (globalThis as Record<string, unknown>)[name] === value;
  } catch {
    return false;
  }
}

/**
 * Node/host values: `process`, `globalThis`, constructors, and prototypes.
 * Plain objects, arrays, and math brands are not host values.
 */
function isHostIdentity(value: object): boolean {
  if (value === globalThis) return true;
  if (typeof process !== 'undefined' && value === (process as unknown as object)) return true;
  if (value === Object.prototype || value === Array.prototype) return true;
  if (typeof value === 'function') return isGlobalFunction(value);
  const proto = Object.getPrototypeOf(value) as { constructor?: unknown } | null;
  const ctor = proto?.constructor;
  if (typeof ctor !== 'function' || ctor === Object || ctor === Array) return false;
  const name = ctor.name;
  if (!name) return false;
  try {
    return (globalThis as Record<string, unknown>)[name] === ctor;
  } catch {
    return true;
  }
}

/**
 * Brand of a matrix of the matrix package: the global-registry symbol that `Matrix.prototype`
 * carries (`matrix/src/types/type-marker.ts`). `DenseMatrix` and `SparseMatrix` inherit it. The
 * expression package does not depend on the matrix package, so it reads the brand by its registry
 * name. Safe evaluate cannot make or read a symbol, so only host code can put the brand on a value.
 */
const NATIVE_MATRIX_BRAND = Symbol.for('mathts.matrix.Matrix');

function isNativeMatrix(value: object): boolean {
  return (value as Record<symbol, unknown>)[NATIVE_MATRIX_BRAND] === true;
}

/**
 * The storage of a matrix of the matrix package: `Float64Array` or `Float32Array` entries, and
 * `Int32Array` indices. These arrays hold numbers only. A typed array of any other kind is not
 * storage of a matrix and stays refused.
 */
function isMatrixStorageArray(value: unknown): boolean {
  return (
    value instanceof Float64Array || value instanceof Float32Array || value instanceof Int32Array
  );
}

function isMathBrand(value: object): boolean {
  if (
    isComplex(value) ||
    isNativeMatrix(value) ||
    isFraction(value) ||
    isBigNumber(value) ||
    isMatrix(value) ||
    isUnit(value) ||
    isResultSet(value)
  ) {
    return true;
  }
  if (
    value instanceof Float64Array ||
    value instanceof Float32Array ||
    value instanceof Int32Array
  ) {
    return true;
  }
  return (value as { isTensor?: boolean }).isTensor === true;
}

function isDataObject(value: object): boolean {
  if (value === Object.prototype) return false;
  if (isPlainObject(value)) return true;
  return Object.getPrototypeOf(value) === null;
}

/**
 * Refuse to hand a host object back from safe evaluate.
 * Math-namespace functions stay (they are the public API). User functions that
 * are not native stay too: a scope whose prototype carries `parse` is the G22
 * case and must still return that function. Nested host references throw.
 */
export function sanitizeEvaluateResult(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  trusted: Set<unknown> = new Set()
): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string' || t === 'bigint') return value;
  if (t === 'symbol') {
    throw new Error(
      'Security: evaluate cannot return a host object. Scope values are not exfiltrated by identity.'
    );
  }
  if (t === 'function') {
    if (trusted.has(value)) return value;
    if (isNativeFunction(value) || isGlobalFunction(value as Function)) {
      throw new Error(
        'Security: evaluate cannot return a host object. Scope values are not exfiltrated by identity.'
      );
    }
    return value;
  }
  if (t !== 'object') return value;

  const obj = value as object;
  if (isHostIdentity(obj) || (!isDataObject(obj) && !Array.isArray(obj) && !isMathBrand(obj))) {
    throw new Error(
      'Security: evaluate cannot return a host object. Scope values are not exfiltrated by identity.'
    );
  }

  if (seen.has(obj)) return value;
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((entry) => sanitizeEvaluateResult(entry, seen, trusted));
  }

  if (ArrayBuffer.isView(obj)) return value;

  if (isDataObject(obj)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (!isSafeProperty(out, key)) continue;
      setSafeProperty(
        out,
        key,
        sanitizeEvaluateResult((obj as Record<string, unknown>)[key], seen, trusted)
      );
    }
    return out;
  }

  // The typed arrays of a matrix of the matrix package are its own storage. They pass here only.
  // A typed array on its own, or in an object that has no matrix brand, is still refused.
  const nativeMatrix = isNativeMatrix(obj);
  for (const key of Object.keys(obj)) {
    const child = (obj as Record<string, unknown>)[key];
    if (nativeMatrix && isMatrixStorageArray(child)) continue;
    if (child !== null && (typeof child === 'object' || typeof child === 'function')) {
      sanitizeEvaluateResult(child, seen, trusted);
    }
  }
  return value;
}
