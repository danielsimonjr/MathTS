/**
 * Calculus connectors (Wave C / bridge C3).
 *
 * `hessian` is the missing second-order object between calculus, optimization, and
 * linear algebra — second-order optimizers and Laplace approximations need it.
 * Numeric central differences over any `f: ℝⁿ → ℝ` (no AD-compatibility required);
 * complements the symbolic `jacobian`/`gradientSymbolic` and the AD `gradientAt`.
 */
type Vec = readonly number[] | Float64Array;
type ScalarField = (x: number[]) => number;

/**
 * Numeric gradient of sampled data `y` over abscissae `x` (unit spacing, a scalar
 * `dx`, or an explicit grid). Central differences in the interior, one-sided at the
 * edges — matches `numpy.gradient`. Distinct from the AD `gradientAt` (this works on
 * sampled values, not a differentiable function).
 */
export function gradient(y: Vec, x?: Vec | number): number[] {
  const a = Array.isArray(y) ? (y as number[]) : Array.from(y);
  const n = a.length;
  if (n < 2) throw new Error('gradient: need at least 2 samples');
  const coord =
    typeof x === 'number'
      ? Array.from({ length: n }, (_, i) => i * x)
      : x !== undefined
        ? (Array.isArray(x) ? (x as number[]) : Array.from(x))
        : Array.from({ length: n }, (_, i) => i);
  const out = new Array<number>(n);
  out[0] = (a[1] - a[0]) / (coord[1] - coord[0]);
  out[n - 1] = (a[n - 1] - a[n - 2]) / (coord[n - 1] - coord[n - 2]);
  // second-order central difference with (possibly) unequal spacing — numpy.gradient
  for (let i = 1; i < n - 1; i++) {
    const hd = coord[i] - coord[i - 1];
    const hs = coord[i + 1] - coord[i];
    out[i] =
      (-hs / (hd * (hd + hs))) * a[i - 1] +
      ((hs - hd) / (hd * hs)) * a[i] +
      (hd / (hs * (hd + hs))) * a[i + 1];
  }
  return out;
}

/**
 * Numeric Hessian (matrix of second partials) of `f` at `x` via central
 * differences. Symmetric by construction. `h` is the step (default 1e-4, a good
 * tradeoff between truncation and round-off for double precision).
 */
export function hessian(f: ScalarField, x: readonly number[], h = 1e-4): number[][] {
  const n = x.length;
  const base = Array.from(x);
  const f0 = f(base);
  const at = (mods: Array<[number, number]>): number => {
    const p = base.slice();
    for (const [i, d] of mods) p[i] += d;
    return f(p);
  };
  const H: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const h2 = h * h;
  for (let i = 0; i < n; i++) {
    // diagonal: (f(x+h eᵢ) − 2f(x) + f(x−h eᵢ)) / h²
    H[i][i] = (at([[i, h]]) - 2 * f0 + at([[i, -h]])) / h2;
    for (let j = i + 1; j < n; j++) {
      // off-diagonal: symmetric mixed partial
      const v =
        (at([
          [i, h],
          [j, h],
        ]) -
          at([
            [i, h],
            [j, -h],
          ]) -
          at([
            [i, -h],
            [j, h],
          ]) +
          at([
            [i, -h],
            [j, -h],
          ])) /
        (4 * h2);
      H[i][j] = v;
      H[j][i] = v;
    }
  }
  return H;
}
