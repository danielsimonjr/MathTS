/**
 * Reverse-mode AD via tape. Returns the value and the vector-Jacobian product
 * (gradient = ∂(cotangent · value) / ∂x). gradient.shape = x.shape.
 *
 * Default cotangent: ones-like(value) — required for scalar outputs, useful
 * for VJP defaults. For non-scalar value, cotangent's shape must match value.shape.
 */
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from './tape.js';

export function reverseGrad(
  fn: (x: Tensor) => Tensor,
  x: Tensor,
  cotangent?: Tensor
): { value: Tensor; gradient: Tensor } {
  const tape = new Tape();
  const xTaped = TapedTensor.fromTensorAsInput(x, tape);
  const yRaw = fn(xTaped as unknown as Tensor);

  // Guard: fn must return a TapedTensor (not a fresh plain Tensor).
  if (!(yRaw instanceof TapedTensor)) {
    throw new Error(
      'reverseGrad: fn must be AD-traceable — its return must propagate through ' +
        'TapedTensor arithmetic (use add/sub/mul/scale on the argument). A fresh ' +
        'Tensor return loses the tape and silently corrupts the gradient.'
    );
  }
  const yTaped = yRaw;
  const value = yTaped.toPrimalTensor();

  // Resolve cotangent.
  let ct: Tensor;
  if (cotangent === undefined) {
    const data = new Float64Array(value.data.length).fill(1);
    ct = new Tensor(value.shape, data);
  } else {
    if (
      cotangent.shape.length !== value.shape.length ||
      !cotangent.shape.every((v, i) => v === value.shape[i])
    ) {
      throw new Error(
        `reverseGrad: cotangent shape [${cotangent.shape}] != value shape [${value.shape}]`
      );
    }
    ct = cotangent;
  }

  // Replay tape in reverse, seeded with the cotangent.
  tape.backward(yTaped.id, new Float64Array(ct.data));

  const xGradSlot = tape.getInputGrad(xTaped.id)!;
  return {
    value,
    gradient: new Tensor(x.shape, new Float64Array(xGradSlot)),
  };
}
