import {
  isMatrix,
  isComplex,
  isBigNumber,
  isFraction,
  number as toNumber,
} from '@danielsimonjr/mathts-core';
import type { Data } from './types.js';

/** Coerce a single scalar of unknown provenance to a JS number (Complex → real part). */
function scalar(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (isComplex(v)) return (v as { re: number }).re;
  if (isBigNumber(v) || isFraction(v)) {
    try {
      return toNumber(v as never) as number;
    } catch {
      return NaN;
    }
  }
  return Number(v as number);
}

/** Unwrap a core Matrix (or leave arrays/typed-arrays as-is) to a nested/flat JS array. */
function unwrap(raw: Data): unknown {
  if (isMatrix(raw)) {
    try {
      return (raw as { toArray(): unknown }).toArray();
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Flatten + coerce to finite numbers; non-finite entries are dropped. */
export function coerce1d(raw: Data): number[] {
  const u = unwrap(raw);
  const arr = Array.isArray(u) ? u.flat(Infinity) : u instanceof Float64Array ? Array.from(u) : [];
  const out: number[] = [];
  for (const v of arr) {
    const n = scalar(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Like coerce1d but position-preserving: non-finite stays NaN (no dropping). */
export function coerce1dPositional(raw: Data): number[] {
  const u = unwrap(raw);
  const arr = Array.isArray(u) ? u.flat(Infinity) : u instanceof Float64Array ? Array.from(u) : [];
  return arr.map((v) => scalar(v));
}

/** Coerce a 2-D grid; each cell → number (non-finite kept as NaN gaps). */
export function coerce2d(raw: Data): number[][] {
  const u = unwrap(raw);
  if (!Array.isArray(u)) return [];
  return u.map((row) => {
    const r = row instanceof Float64Array ? Array.from(row) : Array.isArray(row) ? row : [row];
    return r.map((v) => {
      const n = scalar(v);
      return Number.isFinite(n) ? n : NaN;
    });
  });
}
