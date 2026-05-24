/**
 * AD over WASM-routed primitives (UPT v0.7 §10.2 Q3).
 *
 * The UPT v0.70 proposal asks: "How does mathts-autograd interact
 * with WASM-accelerated kernels? Do those operations have AD rules?"
 *
 * Answer (demonstrated here): the autograd `Tape` does not care
 * about the FORWARD-PASS strategy. It only requires (1) the primal
 * outputs produced by the forward op and (2) a backward closure that
 * implements the adjoint for that op. A forward op can therefore
 * execute through `computePool.<op>` — which routes to either the
 * in-process JS kernel, the worker pool, or the WASM tier per the
 * `thresholdByOp` map in `parallel/src/ComputePool.ts` — and the
 * autograd backward pass remains correct so long as the user
 * supplies the correct adjoint closure.
 *
 * This test pins that integration: it does the FORWARD pass via
 * `ComputePool.add` (a WASM-aware primitive), records the op on a
 * `Tape` with the elementwise-add adjoint, runs `backward`, and
 * verifies the gradients match the analytical result. The same
 * pattern works for any other ComputePool op — `multiply`, `matmul`
 * (when its adjoint `dA = dY·Bᵀ`, `dB = Aᵀ·dY` is supplied),
 * `divide`, `scale`, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Tape } from '../src/tape.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

describe('AD over WASM-routed primitives (UPT v0.7 §10.2 Q3)', () => {
  beforeAll(async () => {
    // Ensure the pool is ready. Even when the bench-derived
    // thresholdByOp keeps `add` sequential, the dispatch path is
    // identical to the one a WASM-aware op (e.g. `matmul`,
    // `besselJ`) traverses, so this exercises the same wiring.
    await computePool.initialize();
  });

  it('Tape.record + computePool.add: backward yields the elementwise-add adjoint', async () => {
    const a = new Float64Array([1, 2, 3, 4]);
    const b = new Float64Array([10, 20, 30, 40]);

    // Build a tape with two leaf inputs.
    const tape = new Tape();
    const aLeaf = tape.allocate(a.length);
    const bLeaf = tape.allocate(b.length);

    // FORWARD via ComputePool.add — this is the WASM-aware primitive
    // path: the call goes through the same dispatch surface that a
    // WASM-backed matmul / besselJ / etc. would use.
    const { result } = await computePool.add(a, b);
    expect(result).toBeInstanceOf(Float64Array);
    expect(Array.from(result)).toEqual([11, 22, 33, 44]);

    // Record the op on the tape with the analytical adjoint
    // (dA = dY, dB = dY for elementwise add).
    const { id: outputId } = tape.record(
      [aLeaf.id, bLeaf.id],
      result.length,
      (outputGrad) => {
        // Push outputGrad into both inputs' grad slots.
        for (let i = 0; i < outputGrad.length; i++) {
          aLeaf.gradSlot[i] += outputGrad[i];
          bLeaf.gradSlot[i] += outputGrad[i];
        }
      }
    );

    // Seed the output cotangent and replay backward.
    const cotangent = new Float64Array([1, 1, 1, 1]);
    tape.backward(outputId, cotangent);

    // Verify each leaf received the correct gradient.
    expect(Array.from(aLeaf.gradSlot)).toEqual([1, 1, 1, 1]);
    expect(Array.from(bLeaf.gradSlot)).toEqual([1, 1, 1, 1]);
  });

  it('Tape.record + computePool.multiply: backward yields the elementwise-product adjoint', async () => {
    const a = new Float64Array([2, 3, 5]);
    const b = new Float64Array([7, 11, 13]);

    const tape = new Tape();
    const aLeaf = tape.allocate(a.length);
    const bLeaf = tape.allocate(b.length);

    // FORWARD: y = a * b (elementwise) via ComputePool.
    const { result } = await computePool.multiply(a, b);
    expect(Array.from(result)).toEqual([14, 33, 65]);

    // Record op with adjoint dA = b·dY, dB = a·dY.
    const { id: outputId } = tape.record(
      [aLeaf.id, bLeaf.id],
      result.length,
      (outputGrad) => {
        for (let i = 0; i < outputGrad.length; i++) {
          aLeaf.gradSlot[i] += b[i] * outputGrad[i];
          bLeaf.gradSlot[i] += a[i] * outputGrad[i];
        }
      }
    );

    // Cotangent = [1, 1, 1]; expected dA = b, dB = a.
    tape.backward(outputId, new Float64Array([1, 1, 1]));
    expect(Array.from(aLeaf.gradSlot)).toEqual([7, 11, 13]);
    expect(Array.from(bLeaf.gradSlot)).toEqual([2, 3, 5]);
  });

  it('chained ComputePool ops compose on a single tape (add → scale → backward)', async () => {
    // Forward: y = (a + b) * k, where k is a scalar.
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([4, 5, 6]);
    const k = 3;

    const tape = new Tape();
    const aLeaf = tape.allocate(a.length);
    const bLeaf = tape.allocate(b.length);

    // First op: s = a + b.
    const sumResult = (await computePool.add(a, b)).result;
    const { id: sumId, gradSlot: sumGrad } = tape.record(
      [aLeaf.id, bLeaf.id],
      sumResult.length,
      (outputGrad) => {
        for (let i = 0; i < outputGrad.length; i++) {
          aLeaf.gradSlot[i] += outputGrad[i];
          bLeaf.gradSlot[i] += outputGrad[i];
        }
      }
    );

    // Second op: y = s * k.
    const yResult = (await computePool.scale(sumResult, k)).result;
    const { id: yId } = tape.record([sumId], yResult.length, (outputGrad) => {
      for (let i = 0; i < outputGrad.length; i++) {
        sumGrad[i] += k * outputGrad[i];
      }
    });

    // Seed and replay: cotangent = [1, 1, 1].
    tape.backward(yId, new Float64Array([1, 1, 1]));

    // y = k·(a + b); dY/dA = dY/dB = k = 3.
    expect(Array.from(aLeaf.gradSlot)).toEqual([3, 3, 3]);
    expect(Array.from(bLeaf.gradSlot)).toEqual([3, 3, 3]);
    // Forward sanity check.
    expect(Array.from(yResult)).toEqual([15, 21, 27]);
  });
});
