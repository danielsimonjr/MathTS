/**
 * Canonical elementary-function derivative rules for forward-mode automatic
 * differentiation. This is the single source of truth for the chain rules,
 * shared by the scalar {@link Dual} (core) and the tensor `DualTensor`
 * (autograd) so neither reinvents them.
 *
 * Each rule is a pair of pure `number → number` functions:
 *   - `primal(x)` — f(x)
 *   - `deriv(x, y)` — f′(x), given both x and the already-computed y = f(x),
 *     so output-reusing derivatives (exp, tanh, sqrt, cbrt, expm1) stay cheap.
 *
 * Keeping these as plain scalar functions (no `Dual`/`Tensor` allocation) is
 * what lets autograd's `Float64Array` element-wise loop stay allocation-free.
 * It is also the propagation path: a future accelerated `primal` in the
 * standard layer (WASM/SIMD batch kernels) can be swapped in here and every
 * consumer inherits the speedup without touching this contract.
 */

/** A forward-mode derivative rule for a unary elementary function. */
export interface DualUnaryRule {
  /** f(x). */
  readonly primal: (x: number) => number;
  /** f′(x), given x and y = f(x) (y lets exp/tanh/sqrt/… avoid recomputation). */
  readonly deriv: (x: number, y: number) => number;
}

/**
 * The canonical table. Derivatives are stated in the cheapest exact form
 * (reusing y where that avoids a redundant transcendental call).
 */
export const DUAL_UNARY_RULES = {
  exp: { primal: Math.exp, deriv: (_x, y) => y },
  expm1: { primal: Math.expm1, deriv: (_x, y) => y + 1 },
  log: { primal: Math.log, deriv: (x) => 1 / x },
  log2: { primal: Math.log2, deriv: (x) => 1 / (x * Math.LN2) },
  log10: { primal: Math.log10, deriv: (x) => 1 / (x * Math.LN10) },
  log1p: { primal: Math.log1p, deriv: (x) => 1 / (1 + x) },
  sin: { primal: Math.sin, deriv: (x) => Math.cos(x) },
  cos: { primal: Math.cos, deriv: (x) => -Math.sin(x) },
  tan: { primal: Math.tan, deriv: (x) => 1 / (Math.cos(x) * Math.cos(x)) },
  asin: { primal: Math.asin, deriv: (x) => 1 / Math.sqrt(1 - x * x) },
  acos: { primal: Math.acos, deriv: (x) => -1 / Math.sqrt(1 - x * x) },
  atan: { primal: Math.atan, deriv: (x) => 1 / (1 + x * x) },
  sinh: { primal: Math.sinh, deriv: (x) => Math.cosh(x) },
  cosh: { primal: Math.cosh, deriv: (x) => Math.sinh(x) },
  tanh: { primal: Math.tanh, deriv: (_x, y) => 1 - y * y },
  asinh: { primal: Math.asinh, deriv: (x) => 1 / Math.sqrt(x * x + 1) },
  acosh: { primal: Math.acosh, deriv: (x) => 1 / Math.sqrt(x * x - 1) },
  atanh: { primal: Math.atanh, deriv: (x) => 1 / (1 - x * x) },
  sqrt: { primal: Math.sqrt, deriv: (_x, y) => 1 / (2 * y) },
  cbrt: { primal: Math.cbrt, deriv: (_x, y) => 1 / (3 * y * y) },
  square: { primal: (x) => x * x, deriv: (x) => 2 * x },
  reciprocal: { primal: (x) => 1 / x, deriv: (x) => -1 / (x * x) },
  abs: { primal: Math.abs, deriv: (x) => Math.sign(x) },
  sign: { primal: Math.sign, deriv: () => 0 },
} satisfies Record<string, DualUnaryRule>;

/** Name of a rule in {@link DUAL_UNARY_RULES}. */
export type DualUnaryRuleName = keyof typeof DUAL_UNARY_RULES;
