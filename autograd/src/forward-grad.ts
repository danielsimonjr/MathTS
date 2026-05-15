/**
 * Forward-mode AD via dual numbers. Returns the value and the full Jacobian
 * of fn at x, shape [...value.shape, ...x.shape] (row-major flatten).
 *
 * Implementation: for each flat-index k in x, build a DualTensor with a unit
 * tangent at position k, run fn (which operates on Tensors — see "interop"
 * below), extract the tangent of the result. The tangent is the k-th column
 * of the Jacobian (in row-major-of-output-flattened form).
 *
 * Interop with the Tensor type: fn is typed `(x: Tensor) => Tensor`, so the
 * tracing requires fn's body to be implementable on either Tensor OR
 * DualTensor. v0.1.0 ships a documented "trace mode" — if fn uses only the
 * core ops that DualTensor implements (add/sub/mul/scale), the
 * implementation auto-traces by detecting DualTensor inputs via a thin
 * wrapper. The actual mechanism in v0.1.0: caller writes fn as if Tensor's
 * methods accept either Tensor or DualTensor (TypeScript's structural typing
 * makes this work for the implemented ops). v0.2.0 may broaden via decorator
 * instrumentation.
 *
 * For UPT v0.4.0's call-sites (metric functions in christoffel lowering),
 * fn uses only add/sub/mul/scale → safe.
 *
 * @packageDocumentation
 */
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { DualTensor } from './dual-tensor.js';

/**
 * Compute the value and full Jacobian of `fn` at point `x` using forward-mode
 * automatic differentiation (dual numbers).
 *
 * @param fn - Pure function operating on Tensors via add/sub/mul/scale.
 *   Must be traceable: at runtime it receives a DualTensor (structurally
 *   compatible with Tensor) and must return a DualTensor.
 * @param x - Input tensor at which to differentiate.
 * @returns `{ value, jacobian }` where:
 *   - `value` has shape `x.shape` (or the output shape of fn)
 *   - `jacobian` has shape `[...value.shape, ...x.shape]` row-major.
 *     `jacobian.data[kY * xSize + kX]` = ∂y[kY] / ∂x[kX].
 *     Verified by Adam+Eve review 2026-05-15 (E13): kY outer, kX inner,
 *     stride xSize between successive y-rows IS row-major [...y.shape, ...x.shape].
 */
export function forwardGrad(
  fn: (x: Tensor) => Tensor,
  x: Tensor,
): { value: Tensor; jacobian: Tensor } {
  // First call: compute the value with zero tangent to learn the output shape.
  // (We need to know the output shape to allocate the Jacobian.)
  const xDualZero = DualTensor.fromTensor(x);
  const yProbe = fn(xDualZero as unknown as Tensor);
  // yProbe is structurally a DualTensor (we passed one in); cast back.
  const yPrimal = (yProbe as unknown as DualTensor).toPrimalTensor();

  const jacobianShape = [...yPrimal.shape, ...x.shape];
  const jacobianSize = jacobianShape.reduce((a, b) => a * b, 1);
  const jacobianData = new Float64Array(jacobianSize);

  // Output flat-index stride: how much to skip in the Jacobian per
  // *output* flat-index. The Jacobian is laid out row-major as
  // [...y.shape, ...x.shape] — so the output flat-index k_y advances
  // jacobianStrideY = product(x.shape) entries; the input flat-index k_x
  // advances by 1.
  const xSize = x.data.length;
  const ySize = yPrimal.data.length;

  // Sweep each input flat-index k_x. For each: build a unit-tangent
  // DualTensor at position k_x, run fn, scatter the tangent into the
  // jacobian.
  //
  // Layout: row-major [...y.shape, ...x.shape] — Jacobian[kY * xSize + kX]
  // = ∂y[kY] / ∂x[kX]. Verified by Adam+Eve review 2026-05-15 (E13).
  for (let kX = 0; kX < xSize; kX++) {
    const xDualUnit = DualTensor.unitAt(x, kX);
    const yDual = fn(xDualUnit as unknown as Tensor) as unknown as DualTensor;
    for (let kY = 0; kY < ySize; kY++) {
      jacobianData[kY * xSize + kX] = yDual.tangent[kY];
    }
  }

  return {
    value: yPrimal,
    jacobian: new Tensor(jacobianShape, jacobianData),
  };
}
