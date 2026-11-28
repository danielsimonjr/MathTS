import type BigNumber from 'bignumber.js';
import type { Complex } from 'complex.js';

type Scalar = number | BigNumber | Complex;

interface EigsDedupePair {
  value: Scalar;
  vector: Scalar[];
}

export function dedupeEigenpairs(
  pairs: EigsDedupePair[],
  prec: number,
  subtract: (a: Scalar, b: Scalar) => Scalar,
  abs: (x: Scalar) => number | BigNumber,
  dot: (a: Scalar[], b: Scalar[]) => Scalar,
  norm: (v: Scalar[]) => Scalar
): EigsDedupePair[] {
  const tolRaw = prec;
  const tol = Number.isFinite(tolRaw) && tolRaw > 0 ? tolRaw : 1e-12;
  const geoTol = Math.max(tol, 1e-9);
  const out: EigsDedupePair[] = [];
  for (const p of pairs) {
    const ix = out.findIndex(
      (q) =>
        Number(abs(subtract(q.value, p.value) as Scalar)) <= geoTol &&
        vectorsSameDirection(q.vector, p.vector, geoTol, dot, norm)
    );
    if (ix === -1) out.push(p);
  }
  if (
    out.length === 2 &&
    Number(abs(subtract(out[0]!.value, out[1]!.value) as Scalar)) <= geoTol &&
    vectorsSameDirection(out[0]!.vector, out[1]!.vector, geoTol, dot, norm)
  ) {
    return [out[0]!];
  }
  return out;
}

function vectorsSameDirection(
  u: Scalar[],
  v: Scalar[],
  tol: number,
  dot: (a: Scalar[], b: Scalar[]) => Scalar,
  norm: (v: Scalar[]) => Scalar
): boolean {
  if (u.length !== v.length) return false;
  if (u.every((x, i) => Math.abs(Number(x) - Number(v[i])) <= tol)) return true;
  const nu = Number(norm(u));
  const nv = Number(norm(v));
  if (!(nu > 0) || !(nv > 0)) return true;
  return Math.abs(Number(dot(u, v))) / (nu * nv) > 1 - Math.max(tol, 1e-6);
}