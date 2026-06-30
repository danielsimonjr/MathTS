/**
 * GC15 — ergonomic, number-friendly autodiff bridge.
 *
 * The low-level building blocks (`Tape`, `TapedTensor`, `reverseGrad`) require
 * manual tape management and `Tensor` marshalling. This is the JAX-style
 * convenience layer: write a function of a single `TapedTensor` (the AD-aware
 * surface — `.sin()`, `.mul()`, `.sum()`, `.matmul()`, … all record adjoints)
 * and differentiate it against plain JS numbers / arrays.
 *
 *   grad((x) => x.sin())(1)              // [cos(1)]
 *   valueAndGrad((x) => x.pow(2).sum())([1, 2, 3])  // { value: 14, grad: [2,4,6] }
 *   derivative((x) => x.sin().mul(x), 2) // sin(2) + 2cos(2)
 *
 * `f` must use TapedTensor operations (not the plain `functions/` ops, which are
 * not AD-aware). Differentiating arbitrary `functions/` ops would require
 * overloading them onto dual numbers / the tape — a separate, larger effort.
 */
import { Tape, TapedTensor } from './tape.js';

export type ScalarFn = (x: TapedTensor) => TapedTensor;
export type NumericInput = number | readonly number[] | Float64Array;

function toFloat64(x: NumericInput): Float64Array {
  if (typeof x === 'number') return Float64Array.of(x);
  return x instanceof Float64Array ? new Float64Array(x) : Float64Array.from(x);
}

/**
 * Forward value and reverse-mode gradient of a scalar-valued function.
 *
 * @param fn  maps a TapedTensor (shape `[n]`) to a scalar TapedTensor (length 1).
 * @param x   the point — a number, number[], or Float64Array.
 * @returns   `{ value, grad }` where `grad` has the same length as `x`.
 * @throws    if `fn` does not return a length-1 (scalar) result.
 */
export function valueAndGrad(
  fn: ScalarFn,
  x: NumericInput
): { value: number; grad: Float64Array } {
  const xs = toFloat64(x);
  const tape = new Tape();
  const { id } = tape.allocate(xs.length);
  const leaf = new TapedTensor([xs.length], xs, tape, id);
  const out = fn(leaf);
  if (out.primal.length !== 1) {
    throw new Error(
      `valueAndGrad: fn must return a scalar (length 1); got length ${out.primal.length}. ` +
        'Reduce with .sum()/.mean(), or use jacobian() for vector outputs.'
    );
  }
  tape.backward(out.id, Float64Array.of(1));
  return { value: out.primal[0], grad: new Float64Array(tape.getInputGrad(id)!) };
}

/**
 * Gradient function of a scalar-valued function: `grad(f)(x)` returns ∇f(x).
 */
export function grad(fn: ScalarFn): (x: NumericInput) => Float64Array {
  return (x) => valueAndGrad(fn, x).grad;
}

/**
 * Scalar convenience: derivative of `f: ℝ → ℝ` at `x0`.
 */
export function derivative(fn: ScalarFn, x0: number): number {
  return valueAndGrad(fn, x0).grad[0];
}

/**
 * Jacobian of a vector-valued function `f: ℝⁿ → ℝᵐ`, one reverse pass per output
 * row. Returns an `m × n` array. (For tall outputs forward-mode is cheaper; this
 * favours wide-input / few-output cases, the common ML gradient shape.)
 */
export function jacobian(fn: ScalarFn, x: NumericInput): number[][] {
  const xs = toFloat64(x);
  // Probe the output dimension once.
  const probeTape = new Tape();
  const { id: probeId } = probeTape.allocate(xs.length);
  const probeOut = fn(new TapedTensor([xs.length], new Float64Array(xs), probeTape, probeId));
  const m = probeOut.primal.length;

  const rows: number[][] = [];
  for (let r = 0; r < m; r++) {
    const tape = new Tape();
    const { id } = tape.allocate(xs.length);
    const out = fn(new TapedTensor([xs.length], new Float64Array(xs), tape, id));
    const seed = new Float64Array(m);
    seed[r] = 1;
    tape.backward(out.id, seed);
    rows.push(Array.from(tape.getInputGrad(id)!));
  }
  return rows;
}
