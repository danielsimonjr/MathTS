/**
 * Tests for reverse-mode AD over TapedTensor.contract and TapedTensor.matmul.
 *
 * Adjoint derivations used:
 *   contract:  dA = dY.contract(B_relabelled)  where B's free axes match dY's B-side
 *              labels and B's shared axes are relabelled with A's Index objects.
 *              Symmetrically: dB = A_relabelled.contract(dY).
 *              (Equivalent to: dA[aFree...,aShared...] = Σ_{bFree} dY[aFree...,bFree...] * B[bShared...,bFree...])
 *
 *   matmul:    Y = A @ B  (A: ...×m×k, B: ...×k×n → Y: ...×m×n)
 *              dA = dY @ Bᵀ  (elementwise: dA[...,i,q] = Σ_j dY[...,i,j] * B[...,q,j])
 *              dB = Aᵀ @ dY  (elementwise: dB[...,q,j] = Σ_i A[...,i,q] * dY[...,i,j])
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { idx } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '../src/tape.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sum all elements of a TapedTensor (returns a single-element TapedTensor of shape []). */
function tapedSum(t: TapedTensor): TapedTensor {
  // Fold all elements by repeatedly adding 1-element slices.
  // Simplest: scale by 1 for each element and chain adds —
  // but we don't have a reduce primitive. Instead, implement sum via
  // the known-working mul+scale: use scale(1) and accumulate.
  //
  // Actually the cleanest approach is: return t.scale(1) and seed the
  // backward with an all-ones gradient to simulate "sum".
  // For testing we'll just return the flat tensor and seed backward(id, ones).
  return t.scale(1.0);
}

/**
 * Run reverse-mode AD on a computation that takes two TapedTensor leaves (A, B)
 * and returns a scalar (summed) output. Returns [gradA, gradB].
 */
function reverseGradTwo(
  tapeFn: (A: TapedTensor, B: TapedTensor) => TapedTensor,
  aTensor: Tensor,
  bTensor: Tensor
): { gradA: Float64Array; gradB: Float64Array; value: Tensor } {
  const tape = new Tape();
  const A = TapedTensor.fromTensorAsInput(aTensor, tape);
  const B = TapedTensor.fromTensorAsInput(bTensor, tape);
  const Y = tapeFn(A, B);
  // Seed output gradient with ones (= gradient of the sum).
  const onesGrad = new Float64Array(Y.primal.length).fill(1.0);
  tape.backward(Y.id, onesGrad);
  return {
    gradA: new Float64Array(tape.getInputGrad(A.id)!),
    gradB: new Float64Array(tape.getInputGrad(B.id)!),
    value: Y.toPrimalTensor(),
  };
}

/**
 * Numerical gradient (central finite differences) of sum(f(A, B)) w.r.t. A.
 * ε = 1e-6.
 */
function numericalGradA(
  fFwd: (aData: Float64Array, bData: Float64Array) => Float64Array,
  aData: Float64Array,
  bData: Float64Array,
  eps = 1e-6
): Float64Array {
  const grad = new Float64Array(aData.length);
  for (let i = 0; i < aData.length; i++) {
    const aPlus = new Float64Array(aData);
    aPlus[i] += eps;
    const aMinus = new Float64Array(aData);
    aMinus[i] -= eps;
    const fPlus = fFwd(aPlus, bData).reduce((s, x) => s + x, 0);
    const fMinus = fFwd(aMinus, bData).reduce((s, x) => s + x, 0);
    grad[i] = (fPlus - fMinus) / (2 * eps);
  }
  return grad;
}

/**
 * Numerical gradient of sum(f(A, B)) w.r.t. B.
 */
function numericalGradB(
  fFwd: (aData: Float64Array, bData: Float64Array) => Float64Array,
  aData: Float64Array,
  bData: Float64Array,
  eps = 1e-6
): Float64Array {
  const grad = new Float64Array(bData.length);
  for (let i = 0; i < bData.length; i++) {
    const bPlus = new Float64Array(bData);
    bPlus[i] += eps;
    const bMinus = new Float64Array(bData);
    bMinus[i] -= eps;
    const fPlus = fFwd(aData, bPlus).reduce((s, x) => s + x, 0);
    const fMinus = fFwd(aData, bMinus).reduce((s, x) => s + x, 0);
    grad[i] = (fPlus - fMinus) / (2 * eps);
  }
  return grad;
}

function assertClose(a: Float64Array, b: Float64Array, tol = 1e-7, label = ''): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    expect(diff).toBeLessThan(tol);
    if (diff >= tol) {
      throw new Error(`${label}: element [${i}] differs: ${a[i]} vs ${b[i]}, diff=${diff}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('TapedTensor.contract — forward pass', () => {
  it('3×4 ⊗ 4×5 → 3×5 forward output matches Tensor.contract', () => {
    const iIdx = idx(3, 'i');
    const jIdx = idx(4, 'j');
    const kIdx = idx(5, 'k');

    const aData = new Float64Array(12);
    for (let x = 0; x < 12; x++) aData[x] = x + 1;
    const bData = new Float64Array(20);
    for (let x = 0; x < 20; x++) bData[x] = x + 1;

    const aTensor = new Tensor([3, 4], new Float64Array(aData), [iIdx, jIdx]);
    const bTensor = new Tensor([4, 5], new Float64Array(bData), [jIdx, kIdx]);

    // Reference: Tensor.contract
    const ref = aTensor.contract(bTensor);

    // TapedTensor forward
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);
    const Y = A.contract(B);

    expect(Y.shape).toEqual([3, 5]);
    expect(Y.axisLabels).toBeDefined();
    expect(Y.axisLabels![0].matches(iIdx)).toBe(true);
    expect(Y.axisLabels![1].matches(kIdx)).toBe(true);
    for (let idx2 = 0; idx2 < ref.data.length; idx2++) {
      expect(Math.abs(Y.primal[idx2] - ref.data[idx2])).toBeLessThan(1e-12);
    }
  });
});

describe('TapedTensor.contract — gradient via finite differences', () => {
  it('3×4 ⊗ 4×5: gradient of sum(Y) w.r.t. A matches numerical estimate (tol 1e-7)', () => {
    const iIdx = idx(3, 'i');
    const jIdx = idx(4, 'j');
    const kIdx = idx(5, 'k');

    const aData = new Float64Array(12);
    for (let x = 0; x < 12; x++) aData[x] = (x + 1) * 0.5;
    const bData = new Float64Array(20);
    for (let x = 0; x < 20; x++) bData[x] = (x + 1) * 0.3;

    const fFwd = (ad: Float64Array, bd: Float64Array): Float64Array => {
      const A = new Tensor([3, 4], new Float64Array(ad), [iIdx, jIdx]);
      const B = new Tensor([4, 5], new Float64Array(bd), [jIdx, kIdx]);
      return A.contract(B).data;
    };

    const { gradA, gradB } = reverseGradTwo(
      (A, B) => A.contract(B),
      new Tensor([3, 4], new Float64Array(aData), [iIdx, jIdx]),
      new Tensor([4, 5], new Float64Array(bData), [jIdx, kIdx])
    );

    const numGradA = numericalGradA(fFwd, aData, bData);
    const numGradB = numericalGradB(fFwd, aData, bData);

    assertClose(gradA, numGradA, 1e-7, 'gradA vs numGradA');
    assertClose(gradB, numGradB, 1e-7, 'gradB vs numGradB');
  });

  it('hand-calculation check: sum(Y) grad w.r.t. A = B_row_sums broadcast', () => {
    // Y = A @ B  (3×4 times 4×5 → 3×5)
    // d/dA[i,j] sum(Y) = d/dA[i,j] Σ_{i',k} A[i',j'] * B[j',k]
    //                   = Σ_k B[j,k]   (only term where j'=j contributes)
    // So gradA[i,j] = sum of row j of B (over all k), repeated for each i.
    const iIdx = idx(3, 'i');
    const jIdx = idx(4, 'j');
    const kIdx = idx(5, 'k');

    // Simple B: B[j,k] = 1 for all j,k → gradA[i,j] = 5 for all i,j
    const bData = new Float64Array(20).fill(1.0);
    const aData = new Float64Array(12);
    for (let x = 0; x < 12; x++) aData[x] = x + 1;

    const { gradA } = reverseGradTwo(
      (A, B) => A.contract(B),
      new Tensor([3, 4], new Float64Array(aData), [iIdx, jIdx]),
      new Tensor([4, 5], new Float64Array(bData), [jIdx, kIdx])
    );

    // gradA[i,j] = Σ_k B[j,k] = 5*1 = 5 for all i,j
    for (let i = 0; i < 12; i++) {
      expect(Math.abs(gradA[i] - 5.0)).toBeLessThan(1e-12);
    }
  });
});

describe('TapedTensor.contract — 3-tensor chain', () => {
  it('A.contract(B).contract(C): reverse-mode gradients match finite differences', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const kIdx = idx(4, 'k');
    const lIdx = idx(3, 'l');

    const aData = new Float64Array(6);
    for (let x = 0; x < 6; x++) aData[x] = (x + 1) * 0.7;
    const bData = new Float64Array(12);
    for (let x = 0; x < 12; x++) bData[x] = (x + 1) * 0.4;
    const cData = new Float64Array(12);
    for (let x = 0; x < 12; x++) cData[x] = (x + 1) * 0.5;

    const ATensor = new Tensor([2, 3], new Float64Array(aData), [iIdx, jIdx]);
    const BTensor = new Tensor([3, 4], new Float64Array(bData), [jIdx, kIdx]);
    const CTensor = new Tensor([4, 3], new Float64Array(cData), [kIdx, lIdx]);

    // Analytical gradients from tape
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(ATensor, tape);
    const B = TapedTensor.fromTensorAsInput(BTensor, tape);
    const C = TapedTensor.fromTensorAsInput(CTensor, tape);
    const Y = A.contract(B).contract(C); // shape [2, 3]
    const onesGrad = new Float64Array(Y.primal.length).fill(1.0);
    tape.backward(Y.id, onesGrad);

    const gradA = new Float64Array(tape.getInputGrad(A.id)!);
    const gradB = new Float64Array(tape.getInputGrad(B.id)!);
    const gradC = new Float64Array(tape.getInputGrad(C.id)!);

    // Numerical gradients for A
    const fFwdA = (ad: Float64Array, _bd: Float64Array): Float64Array => {
      const Ao = new Tensor([2, 3], new Float64Array(ad), [iIdx, jIdx]);
      return Ao.contract(BTensor).contract(CTensor).data;
    };
    const numGradA = numericalGradA(fFwdA, aData, bData);
    // Chain compound ops accumulate FD error; allow slightly wider tolerance (2e-7).
    assertClose(gradA, numGradA, 2e-7, 'chain gradA');

    // Numerical gradients for B
    const fFwdB = (ad: Float64Array, bd: Float64Array): Float64Array => {
      const Ao = new Tensor([2, 3], new Float64Array(ad), [iIdx, jIdx]);
      const Bo = new Tensor([3, 4], new Float64Array(bd), [jIdx, kIdx]);
      return Ao.contract(Bo).contract(CTensor).data;
    };
    const numGradB = numericalGradB(fFwdB, aData, bData);
    assertClose(gradB, numGradB, 2e-7, 'chain gradB');

    // Numerical gradients for C
    const fFwdC = (cd: Float64Array, _dummy: Float64Array): Float64Array => {
      const Co = new Tensor([4, 3], new Float64Array(cd), [kIdx, lIdx]);
      return ATensor.contract(BTensor).contract(Co).data;
    };
    const numGradC = numericalGradA(fFwdC, cData, new Float64Array(0));
    assertClose(gradC, numGradC, 2e-7, 'chain gradC');
  });
});

describe('TapedTensor.contract — compositional (contract + add + mul)', () => {
  it('(A.contract(B)).add(C).mul(D): all four leaf gradients correct', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const kIdx = idx(2, 'k');

    // A: 2×3, B: 3×2 → Y=A@B: 2×2. Then Y.add(C).mul(D) where C,D: 2×2.
    const aData = new Float64Array([1, 2, 3, 4, 5, 6]);
    const bData = new Float64Array([1, -1, 2, -2, 3, -3]);
    const cData = new Float64Array([0.1, 0.2, 0.3, 0.4]);
    const dData = new Float64Array([1.0, -0.5, 0.5, -1.0]);

    const ATensor = new Tensor([2, 3], new Float64Array(aData), [iIdx, jIdx]);
    const BTensor = new Tensor([3, 2], new Float64Array(bData), [jIdx, kIdx]);
    // C and D don't need axisLabels since they use TapedTensor.add/mul
    const CTensor = new Tensor([2, 2], new Float64Array(cData));
    const DTensor = new Tensor([2, 2], new Float64Array(dData));

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(ATensor, tape);
    const B = TapedTensor.fromTensorAsInput(BTensor, tape);
    const C = TapedTensor.fromTensorAsInput(CTensor, tape);
    const D = TapedTensor.fromTensorAsInput(DTensor, tape);

    const AB = A.contract(B); // 2×2, no axisLabels passed to add/mul
    // AB has axisLabels [iIdx, kIdx], but C/D have no axisLabels.
    // We need to create AB without axisLabels for the add/mul ops (shape-only match).
    // Use scale(1) to strip axisLabels:
    const ABplain = AB.scale(1); // same values, no axisLabels on the TapedTensor
    const ABpC = ABplain.add(C);
    const final = ABpC.mul(D);
    const onesGrad = new Float64Array(final.primal.length).fill(1.0);
    tape.backward(final.id, onesGrad);

    const gradA = new Float64Array(tape.getInputGrad(A.id)!);
    const gradB = new Float64Array(tape.getInputGrad(B.id)!);
    const gradC = new Float64Array(tape.getInputGrad(C.id)!);
    const gradD = new Float64Array(tape.getInputGrad(D.id)!);

    // Forward function for numerical check
    const fFwdAll = (ad: Float64Array, bd: Float64Array, cd: Float64Array, dd: Float64Array): Float64Array => {
      const Ao = new Tensor([2, 3], new Float64Array(ad), [iIdx, jIdx]);
      const Bo = new Tensor([3, 2], new Float64Array(bd), [jIdx, kIdx]);
      const Co = new Tensor([2, 2], new Float64Array(cd));
      const Do = new Tensor([2, 2], new Float64Array(dd));
      const AB2 = Ao.contract(Bo);
      const AB2plain = new Tensor([2, 2], AB2.data.slice());
      return AB2plain.add(Co).mul(Do).data;
    };

    const eps = 1e-6;

    // gradA
    const numGradA = new Float64Array(aData.length);
    for (let i = 0; i < aData.length; i++) {
      const ap = new Float64Array(aData); ap[i] += eps;
      const am = new Float64Array(aData); am[i] -= eps;
      numGradA[i] = (fFwdAll(ap, bData, cData, dData).reduce((s,x)=>s+x,0) -
                     fFwdAll(am, bData, cData, dData).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradA, numGradA, 1e-7, 'compositional gradA');

    // gradB
    const numGradB = new Float64Array(bData.length);
    for (let i = 0; i < bData.length; i++) {
      const bp = new Float64Array(bData); bp[i] += eps;
      const bm = new Float64Array(bData); bm[i] -= eps;
      numGradB[i] = (fFwdAll(aData, bp, cData, dData).reduce((s,x)=>s+x,0) -
                     fFwdAll(aData, bm, cData, dData).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradB, numGradB, 1e-7, 'compositional gradB');

    // gradC
    const numGradC = new Float64Array(cData.length);
    for (let i = 0; i < cData.length; i++) {
      const cp = new Float64Array(cData); cp[i] += eps;
      const cm = new Float64Array(cData); cm[i] -= eps;
      numGradC[i] = (fFwdAll(aData, bData, cp, dData).reduce((s,x)=>s+x,0) -
                     fFwdAll(aData, bData, cm, dData).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradC, numGradC, 1e-7, 'compositional gradC');

    // gradD
    const numGradD = new Float64Array(dData.length);
    for (let i = 0; i < dData.length; i++) {
      const dp = new Float64Array(dData); dp[i] += eps;
      const dm = new Float64Array(dData); dm[i] -= eps;
      numGradD[i] = (fFwdAll(aData, bData, cData, dp).reduce((s,x)=>s+x,0) -
                     fFwdAll(aData, bData, cData, dm).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradD, numGradD, 1e-7, 'compositional gradD');
  });
});

describe('TapedTensor.contract — error handling', () => {
  it('throws when this TapedTensor lacks axisLabels', () => {
    const jIdx = idx(4, 'j');
    const kIdx = idx(5, 'k');

    const aTensor = new Tensor([3, 4], new Float64Array(12).fill(1)); // no axisLabels
    const bTensor = new Tensor([4, 5], new Float64Array(20).fill(1), [jIdx, kIdx]);

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);

    expect(() => A.contract(B)).toThrow(/axisLabels/);
  });

  it('throws when other TapedTensor lacks axisLabels', () => {
    const iIdx = idx(3, 'i');
    const jIdx = idx(4, 'j');

    const aTensor = new Tensor([3, 4], new Float64Array(12).fill(1), [iIdx, jIdx]);
    const bTensor = new Tensor([4, 5], new Float64Array(20).fill(1)); // no axisLabels

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);

    expect(() => A.contract(B)).toThrow(/axisLabels/);
  });

  it('throws when no shared indices between the two operands', () => {
    const iIdx = idx(3, 'i');
    const jIdx = idx(4, 'j');
    const kIdx = idx(3, 'k');
    const lIdx = idx(4, 'l');

    const aTensor = new Tensor([3, 4], new Float64Array(12).fill(1), [iIdx, jIdx]);
    const bTensor = new Tensor([3, 4], new Float64Array(12).fill(1), [kIdx, lIdx]);

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);

    expect(() => A.contract(B)).toThrow(/no shared indices/);
  });
});

// ---------------------------------------------------------------------------
// Matmul tests
// ---------------------------------------------------------------------------

describe('TapedTensor.matmul — rank-2 classic', () => {
  it('forward output matches Tensor.matMul', () => {
    const aData = new Float64Array([1, 2, 3, 4, 5, 6]);
    const bData = new Float64Array([7, 8, 9, 10, 11, 12]);

    const aTensor = new Tensor([2, 3], new Float64Array(aData));
    const bTensor = new Tensor([3, 2], new Float64Array(bData));

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);
    const Y = A.matmul(B);

    const ref = aTensor.matMul(bTensor);
    expect(Y.shape).toEqual([2, 2]);
    for (let i = 0; i < ref.data.length; i++) {
      expect(Math.abs(Y.primal[i] - ref.data[i])).toBeLessThan(1e-12);
    }
  });

  it('gradients match closed-form dA = dY @ Bᵀ, dB = Aᵀ @ dY (2×3 @ 3×2 → 2×2)', () => {
    const aData = new Float64Array([1, 2, 3, 4, 5, 6]);     // 2×3
    const bData = new Float64Array([0.5, -0.5, 1.5, -1.5, 2.5, -2.5]); // 3×2

    const aTensor = new Tensor([2, 3], new Float64Array(aData));
    const bTensor = new Tensor([3, 2], new Float64Array(bData));

    // Analytical gradients: dY = ones(2×2)
    // dA[i,k] = Σ_j dY[i,j] * B[k,j]  = sum_j B[k,j]  for each i (since dY=ones)
    // dB[k,j] = Σ_i A[i,k] * dY[i,j]  = sum_i A[i,k]  for each j (since dY=ones)
    // dA row 0 = [B col 0 sum, B col 1 sum, ...] for each row of dA... let me compute manually.
    // dA[i,q] = Σ_j dY[i,j] * B[q,j] = Σ_j B[q,j]  (since dY[i,j]=1)
    // B: [[0.5, -0.5], [1.5, -1.5], [2.5, -2.5]]
    // Σ_j B[0,j] = 0.5 + (-0.5) = 0   → dA[i,0] = 0 for all i
    // Σ_j B[1,j] = 1.5 + (-1.5) = 0   → dA[i,1] = 0
    // Σ_j B[2,j] = 2.5 + (-2.5) = 0   → dA[i,2] = 0

    // Let's use a non-cancelling dY instead. Compute via numerics.
    const { gradA, gradB } = reverseGradTwo(
      (A, B) => A.matmul(B),
      aTensor,
      bTensor
    );

    const fFwd = (ad: Float64Array, bd: Float64Array): Float64Array => {
      return new Tensor([2, 3], new Float64Array(ad)).matMul(
        new Tensor([3, 2], new Float64Array(bd))
      ).data;
    };

    const numGradA = numericalGradA(fFwd, aData, bData);
    const numGradB = numericalGradB(fFwd, aData, bData);

    assertClose(gradA, numGradA, 1e-7, 'matmul rank-2 gradA');
    assertClose(gradB, numGradB, 1e-7, 'matmul rank-2 gradB');
  });

  it('gradient w.r.t. A matches dA = dY @ Bᵀ computed directly (3×4 @ 4×5)', () => {
    const M = 3, K = 4, N = 5;
    const aData = new Float64Array(M * K);
    const bData = new Float64Array(K * N);
    for (let x = 0; x < M * K; x++) aData[x] = Math.sin(x + 1);
    for (let x = 0; x < K * N; x++) bData[x] = Math.cos(x + 1);

    const aTensor = new Tensor([M, K], new Float64Array(aData));
    const bTensor = new Tensor([K, N], new Float64Array(bData));

    const { gradA, gradB } = reverseGradTwo(
      (A, B) => A.matmul(B),
      aTensor,
      bTensor
    );

    // dY = ones(M×N), so:
    // dA[i,q] = Σ_j B[q,j]  → dA row i = sum of rows of B
    // dB[q,j] = Σ_i A[i,q]  → dB col j = sum of cols of A
    const expectedDa = new Float64Array(M * K);
    for (let i = 0; i < M; i++) {
      for (let q = 0; q < K; q++) {
        let s = 0;
        for (let j = 0; j < N; j++) s += bData[q * N + j]; // B[q,j], summed over j
        expectedDa[i * K + q] = s;
      }
    }

    const expectedDb = new Float64Array(K * N);
    for (let q = 0; q < K; q++) {
      for (let j = 0; j < N; j++) {
        let s = 0;
        for (let i = 0; i < M; i++) s += aData[i * K + q]; // A[i,q], summed over i
        expectedDb[q * N + j] = s;
      }
    }

    assertClose(gradA, expectedDa, 1e-12, 'matmul 3×4 @ 4×5 gradA vs closed form');
    assertClose(gradB, expectedDb, 1e-12, 'matmul 3×4 @ 4×5 gradB vs closed form');
  });
});

describe('TapedTensor.matmul — rank-3 batched', () => {
  it('batched 2×3×4 @ 2×4×5 → 2×3×5 forward correct', () => {
    const B2 = 2, M = 3, K = 4, N = 5;
    const aData = new Float64Array(B2 * M * K);
    const bData = new Float64Array(B2 * K * N);
    for (let x = 0; x < aData.length; x++) aData[x] = x + 1;
    for (let x = 0; x < bData.length; x++) bData[x] = x + 1;

    const aTensor = new Tensor([B2, M, K], new Float64Array(aData));
    const bTensor = new Tensor([B2, K, N], new Float64Array(bData));

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const Bvar = TapedTensor.fromTensorAsInput(bTensor, tape);
    const Y = A.matmul(Bvar);

    expect(Y.shape).toEqual([B2, M, N]);

    // Reference: compute per-batch matmul manually
    const refData = new Float64Array(B2 * M * N);
    for (let b = 0; b < B2; b++) {
      for (let i = 0; i < M; i++) {
        for (let j = 0; j < N; j++) {
          let s = 0;
          for (let q = 0; q < K; q++) {
            s += aData[b * M * K + i * K + q] * bData[b * K * N + q * N + j];
          }
          refData[b * M * N + i * N + j] = s;
        }
      }
    }

    for (let i = 0; i < refData.length; i++) {
      expect(Math.abs(Y.primal[i] - refData[i])).toBeLessThan(1e-12);
    }
  });

  it('batched 2×3×4 @ 2×4×5: gradients match numerical estimate (tol 1e-7)', () => {
    const B2 = 2, M = 3, K = 4, N = 5;
    const aData = new Float64Array(B2 * M * K);
    const bData = new Float64Array(B2 * K * N);
    for (let x = 0; x < aData.length; x++) aData[x] = Math.sin(x * 0.3 + 1);
    for (let x = 0; x < bData.length; x++) bData[x] = Math.cos(x * 0.4 + 1);

    const aTensor = new Tensor([B2, M, K], new Float64Array(aData));
    const bTensor = new Tensor([B2, K, N], new Float64Array(bData));

    const { gradA, gradB } = reverseGradTwo(
      (A, B) => A.matmul(B),
      aTensor,
      bTensor
    );

    const fFwd = (ad: Float64Array, bd: Float64Array): Float64Array => {
      const Ao = new Tensor([B2, M, K], new Float64Array(ad));
      const Bo = new Tensor([B2, K, N], new Float64Array(bd));
      // Manual batched matmul
      const out = new Float64Array(B2 * M * N);
      for (let b = 0; b < B2; b++) {
        for (let i = 0; i < M; i++) {
          for (let j = 0; j < N; j++) {
            let s = 0;
            for (let q = 0; q < K; q++) {
              s += Ao.data[b * M * K + i * K + q] * Bo.data[b * K * N + q * N + j];
            }
            out[b * M * N + i * N + j] = s;
          }
        }
      }
      return out;
    };

    const numGradA = numericalGradA(fFwd, aData, bData);
    const numGradB = numericalGradB(fFwd, aData, bData);

    assertClose(gradA, numGradA, 1e-7, 'batched matmul gradA');
    assertClose(gradB, numGradB, 1e-7, 'batched matmul gradB');
  });
});

describe('TapedTensor.matmul — error handling', () => {
  it('throws when this is rank-1', () => {
    const aTensor = new Tensor([3], new Float64Array(3).fill(1));
    const bTensor = new Tensor([3, 2], new Float64Array(6).fill(1));

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);

    expect(() => A.matmul(B)).toThrow(/rank ≥ 2/);
  });

  it('throws when other is rank-1', () => {
    const aTensor = new Tensor([2, 3], new Float64Array(6).fill(1));
    const bTensor = new Tensor([3], new Float64Array(3).fill(1));

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);

    expect(() => A.matmul(B)).toThrow(/rank ≥ 2/);
  });
});

describe('TapedTensor — independence: contract and matmul compose with add/sub/mul/scale', () => {
  it('contract(B).scale(2).add(contract(B)) = 3 * (A @ B): consistent gradients', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const kIdx = idx(2, 'k');

    const aData = new Float64Array([1, -1, 2, -2, 3, -3]);
    const bData = new Float64Array([0.5, 1.0, -0.5, -1.0, 1.5, 2.0]);

    const aTensor = new Tensor([2, 3], new Float64Array(aData), [iIdx, jIdx]);
    const bTensor = new Tensor([3, 2], new Float64Array(bData), [jIdx, kIdx]);

    // Compute f(A,B) = contract(B).scale(2).add(contract(B)) = 3*(A@B)
    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);
    const AB1 = A.contract(B);
    const AB2 = A.contract(B);
    const result = AB1.scale(2).add(AB2);
    const onesGrad = new Float64Array(result.primal.length).fill(1.0);
    tape.backward(result.id, onesGrad);

    const gradA = new Float64Array(tape.getInputGrad(A.id)!);
    const gradB = new Float64Array(tape.getInputGrad(B.id)!);

    // Reference: 3 * gradient of sum(A@B) w.r.t. A and B
    const { gradA: gradA_ref, gradB: gradB_ref } = reverseGradTwo(
      (A2, B2) => A2.contract(B2).scale(3.0),
      aTensor,
      bTensor
    );

    assertClose(gradA, gradA_ref, 1e-12, 'compose gradA');
    assertClose(gradB, gradB_ref, 1e-12, 'compose gradB');
  });

  it('matmul(B).sub(C).mul(D) composes cleanly across all leaves', () => {
    const M = 2, K = 3, N = 2;
    const aData = new Float64Array([1, 2, 3, 4, 5, 6]);     // 2×3
    const bData = new Float64Array([1, -1, 2, -2, 3, -3]);  // 3×2
    const cData = new Float64Array([0.5, 1.0, -0.5, -1.0]); // 2×2
    const dData = new Float64Array([2.0, -1.0, 1.0, -2.0]); // 2×2

    const aTensor = new Tensor([M, K], new Float64Array(aData));
    const bTensor = new Tensor([K, N], new Float64Array(bData));
    const cTensor = new Tensor([M, N], new Float64Array(cData));
    const dTensor = new Tensor([M, N], new Float64Array(dData));

    const tape = new Tape();
    const A = TapedTensor.fromTensorAsInput(aTensor, tape);
    const B = TapedTensor.fromTensorAsInput(bTensor, tape);
    const C = TapedTensor.fromTensorAsInput(cTensor, tape);
    const D = TapedTensor.fromTensorAsInput(dTensor, tape);

    const Y = A.matmul(B).sub(C).mul(D);
    const onesGrad = new Float64Array(Y.primal.length).fill(1.0);
    tape.backward(Y.id, onesGrad);

    const gradA = new Float64Array(tape.getInputGrad(A.id)!);
    const gradB = new Float64Array(tape.getInputGrad(B.id)!);
    const gradC = new Float64Array(tape.getInputGrad(C.id)!);
    const gradD = new Float64Array(tape.getInputGrad(D.id)!);

    // Numerical verification
    const fFwdAll = (ad: Float64Array, bd: Float64Array, cd: Float64Array, dd: Float64Array): Float64Array => {
      const Ao = new Tensor([M, K], new Float64Array(ad));
      const Bo = new Tensor([K, N], new Float64Array(bd));
      const Co = new Tensor([M, N], new Float64Array(cd));
      const Do = new Tensor([M, N], new Float64Array(dd));
      return Ao.matMul(Bo).sub(Co).mul(Do).data;
    };

    const eps = 1e-6;
    for (const [grad, data, label, getDiff] of [
      [gradA, aData, 'gradA', (d: Float64Array, i: number, delta: number) => {
        const r = new Float64Array(d); r[i] += delta; return r;
      }] as const,
    ] as Array<[Float64Array, Float64Array, string, (d: Float64Array, i: number, delta: number) => Float64Array]>) {
      const numGrad = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) {
        const ap = getDiff(data, i, eps);
        const am = getDiff(data, i, -eps);
        numGrad[i] = (fFwdAll(ap, bData, cData, dData).reduce((s,x)=>s+x,0) -
                      fFwdAll(am, bData, cData, dData).reduce((s,x)=>s+x,0)) / (2*eps);
      }
      assertClose(grad, numGrad, 1e-7, label);
    }

    // gradB numerical
    const numGradB = new Float64Array(bData.length);
    for (let i = 0; i < bData.length; i++) {
      const bp = new Float64Array(bData); bp[i] += eps;
      const bm = new Float64Array(bData); bm[i] -= eps;
      numGradB[i] = (fFwdAll(aData, bp, cData, dData).reduce((s,x)=>s+x,0) -
                     fFwdAll(aData, bm, cData, dData).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradB, numGradB, 1e-7, 'compose matmul gradB');

    // gradC numerical
    const numGradC = new Float64Array(cData.length);
    for (let i = 0; i < cData.length; i++) {
      const cp = new Float64Array(cData); cp[i] += eps;
      const cm = new Float64Array(cData); cm[i] -= eps;
      numGradC[i] = (fFwdAll(aData, bData, cp, dData).reduce((s,x)=>s+x,0) -
                     fFwdAll(aData, bData, cm, dData).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradC, numGradC, 1e-7, 'compose matmul gradC');

    // gradD numerical
    const numGradD = new Float64Array(dData.length);
    for (let i = 0; i < dData.length; i++) {
      const dp = new Float64Array(dData); dp[i] += eps;
      const dm = new Float64Array(dData); dm[i] -= eps;
      numGradD[i] = (fFwdAll(aData, bData, cData, dp).reduce((s,x)=>s+x,0) -
                     fFwdAll(aData, bData, cData, dm).reduce((s,x)=>s+x,0)) / (2*eps);
    }
    assertClose(gradD, numGradD, 1e-7, 'compose matmul gradD');
  });
});
