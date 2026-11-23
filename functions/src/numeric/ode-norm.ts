/**
 * Root-mean-square norm of a plain-number vector, used for the first step of an ODE driver (the
 * heuristic h0 = 0.01 * ||y0|| / ||f(t0, y0)|| of Hairer). When the squares overflow (a state
 * near 1e154 or more), the sum runs on the vector divided by its largest magnitude: an Infinity
 * norm made the first step NaN or Infinity (#1156). Every other vector takes the plain sum, so
 * its result keeps the same bits. A vector that holds an infinite value has an infinite norm, and
 * a vector that holds a NaN has a NaN norm.
 *
 * An empty vector has no mean. Its norm is `emptyNorm`: NaN by default, so `solveODE` and
 * `solveODESystem` find no first step. `solveDDE` and `solveDAE` pass 0, the value that their
 * own norm gave, and take their small default step.
 *
 * @param v - The vector.
 * @param emptyNorm - The result for an empty vector.
 * @returns The root mean square of `v`.
 */
export function odeRmsNorm(v: readonly number[], emptyNorm = NaN): number {
  if (v.length === 0) return emptyNorm;
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const plain = Math.sqrt(s / v.length);
  if (Number.isFinite(plain)) return plain;
  let m = 0;
  for (let i = 0; i < v.length; i++) m = Math.max(m, Math.abs(v[i]));
  if (!Number.isFinite(m)) return m;
  s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] / m) * (v[i] / m);
  return m * Math.sqrt(s / v.length);
}
