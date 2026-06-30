/**
 * Calculus connectors (Wave C / bridge C3).
 *
 * `hessian` is the missing second-order object between calculus, optimization, and
 * linear algebra — second-order optimizers and Laplace approximations need it.
 * Numeric central differences over any `f: ℝⁿ → ℝ` (no AD-compatibility required);
 * complements the symbolic `jacobian`/`gradientSymbolic` and the AD `gradientAt`.
 */
type ScalarField = (x: number[]) => number;

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
