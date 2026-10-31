/**
 * Deep equality for A/B benchmark results. Leaves are compared with Object.is, so -0, 0 and NaN
 * differ. Walks arrays (holes included), typed arrays, Map and Set, `valueOf()`, and own
 * non-function properties. The two trees load their own copy of every class, so classes are
 * told apart by constructor name, not by identity.
 */

/** @param {object} x */
function constructorName(x) {
  const proto = Object.getPrototypeOf(x);
  if (proto === null) return 'null';
  return typeof proto.constructor === 'function' ? proto.constructor.name : 'Object';
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {WeakMap<object, object>} [seen] pairs already being compared (cycle guard)
 * @returns {boolean}
 */
export function same(a, b, seen = new WeakMap()) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (seen.get(a) === b) return true;
  seen.set(a, b);

  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!(ArrayBuffer.isView(a) && ArrayBuffer.isView(b))) return false;
    if (constructorName(a) !== constructorName(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (constructorName(a) !== constructorName(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (i in a !== i in b) return false;
      if (!same(a[i], b[i], seen)) return false;
    }
    return true;
  }

  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    const ea = [...a];
    const eb = [...b];
    return same(ea, eb, seen);
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    return same([...a], [...b], seen);
  }

  if (typeof a.valueOf === 'function' && typeof b.valueOf === 'function') {
    const va = a.valueOf();
    const vb = b.valueOf();
    if (va !== a || vb !== b) {
      if (!same(va, vb, seen)) return false;
    }
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (typeof a[k] === 'function' && typeof b[k] === 'function') continue;
    if (!same(a[k], b[k], seen)) return false;
  }
  return true;
}

/**
 * Judge one pair of results. A `null` or `undefined` result fails: a tier that returns nothing
 * would otherwise be timed as if it were free (AGENTS.md benchmarking rule 5).
 * @param {unknown} baseResult
 * @param {unknown} headResult
 * @param {((a: unknown, b: unknown) => boolean) | undefined} [compare] a case's own equality
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function checkResults(baseResult, headResult, compare) {
  if (baseResult === null || baseResult === undefined) {
    return { ok: false, reason: `base returned ${baseResult}` };
  }
  if (headResult === null || headResult === undefined) {
    return { ok: false, reason: `head returned ${headResult}` };
  }
  const equal = compare ? compare(baseResult, headResult) : same(baseResult, headResult);
  return equal ? { ok: true } : { ok: false, reason: 'results differ' };
}
