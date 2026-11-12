/**
 * GC15 — ergonomic, number-friendly autodiff bridge.
 *
 * The low-level building blocks (`Tape`, `TapedTensor`, `reverseGrad`) require
 * manual tape management and `Tensor` marshalling. This is the JAX-style
 * convenience layer: write a function of a single `TapedTensor` (the AD-aware
 * surface — `.sin()`, `.mul()`, `.sum()`, `.matmul()`, … all record adjoints)
 * and differentiate it against plain JS numbers / arrays or a rank-N `Tensor`.
 *
 *   grad((x) => x.sin())(1)              // [cos(1)]
 *   valueAndGrad((x) => x.pow(2).sum())([1, 2, 3])  // { value: 14, grad: [2,4,6] }
 *   derivative((x) => x.sin().mul(x), 2) // sin(2) + 2cos(2)
 *
 * `f` must use TapedTensor operations (not the plain `functions/` ops, which are
 * not AD-aware). Differentiating arbitrary `functions/` ops would require
 * overloading them onto dual numbers / the tape — a separate, larger effort.
 */
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from './tape.js';

/**
 * Function that `valueAndGrad`, `grad`, `derivative` and `jacobian` differentiate.
 *
 * The function must build its result from TapedTensor operations only, because only these operations record adjoints.
 * `valueAndGrad`, `grad` and `derivative` require a result of length 1. `jacobian` accepts a vector result.
 */
export type ScalarFn = (x: TapedTensor) => TapedTensor;
/**
 * Point at which a function is differentiated: a number, a number array, a Float64Array, or a `Tensor`.
 *
 * The helpers copy the input into a new Float64Array, so they do not change the caller's array.
 */
export type NumericInput = number | readonly number[] | Float64Array | Tensor;

function resolveInput(x: NumericInput): { data: Float64Array; shape: number[] } {
  if (x instanceof Tensor) {
    return { data: new Float64Array(x.data), shape: [...x.shape] };
  }
  if (typeof x === 'number') {
    return { data: Float64Array.of(x), shape: [1] };
  }
  const data = x instanceof Float64Array ? new Float64Array(x) : Float64Array.from(x);
  return { data, shape: [data.length] };
}

/**
 * Forward value and reverse-mode gradient of a scalar-valued function.
 *
 * @param fn  maps a TapedTensor (shape `[n]`) to a scalar TapedTensor (length 1).
 * @param x   the point — a number, number[], Float64Array, or `Tensor`.
 * @returns   `{ value, grad }` where `grad` is a `Float64Array` with the same size as `x`'s data.
 * @throws    if `fn` does not return a length-1 (scalar) result.
 */
export function valueAndGrad(fn: ScalarFn, x: NumericInput): { value: number; grad: Float64Array } {
  const { data, shape } = resolveInput(x);
  const tape = new Tape();
  const { id } = tape.allocate(data.length);
  const leaf = new TapedTensor(shape, data, tape, id);
  const out = fn(leaf);
  if (out.primal.length !== 1) {
    throw new Error(
      `valueAndGrad: fn must return a scalar (length 1); got length ${out.primal.length}. ` +
        'Reduce with .sum()/.mean(), or use jacobian() for vector outputs.'
    );
  }
  tape.backward(out.id, Float64Array.of(1), { retainGraph: true });
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
 * row. Returns an `m × n` array in row-major output order. Input may be any rank-N
 * `Tensor` shape (flattened internally for the output rows).
 */
export function jacobian(fn: ScalarFn, x: NumericInput): number[][] {
  const { data, shape } = resolveInput(x);
  const n = data.length;
  const probeTape = new Tape();
  const { id: probeId } = probeTape.allocate(n);
  const probeOut = fn(new TapedTensor(shape, new Float64Array(data), probeTape, probeId));
  const m = probeOut.primal.length;

  const rows: number[][] = [];
  for (let r = 0; r < m; r++) {
    const tape = new Tape();
    const { id } = tape.allocate(n);
    const out = fn(new TapedTensor(shape, new Float64Array(data), tape, id));
    const seed = new Float64Array(m);
    seed[r] = 1;
    tape.backward(out.id, seed, { retainGraph: true });
    rows.push(Array.from(tape.getInputGrad(id)!));
  }
  return rows;
}
