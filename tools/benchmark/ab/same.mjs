/**
 * Deep equality for A/B benchmark results. Uses Object.is at leaves so -0, 0 and NaN differ.
 */

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function same(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

  if (typeof a.valueOf === 'function' && typeof b.valueOf === 'function') {
    const va = a.valueOf();
    const vb = b.valueOf();
    if (va !== a || vb !== b) {
      if (Object.is(va, vb)) return true;
      if (typeof va === 'object' && va !== null && typeof vb === 'object' && vb !== null) {
        return same(va, vb);
      }
    }
  }

  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    if (a.constructor !== b.constructor || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!same(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (typeof a[k] === 'function' && typeof b[k] === 'function') continue;
    if (!same(a[k], b[k])) return false;
  }
  return true;
}
