import { describe, it, expect, beforeAll } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { WASMBackend, createWASMBackend } from '../../src/backends/WASMBackend.js';
import { svdWasm } from '../../src/operations/svd-wasm.js';

/**
 * WS-1 P2 — closed-form ENTRY pins for the two matrix-layer paths the oracle
 * matrix listed as SELF-REF: the WASMBackend `inverse` (previously only
 * `A·inv(A) ≈ I`, which a systematically-wrong inverse paired with the same
 * multiply can pass) and `svdWasm` (previously reconstruction + agrees-with-JS,
 * i.e. MathTS-vs-MathTS). Values are hand-derived exact inverses / singular
 * values. See [[feedback-oracle-tests-implementation-independent]].
 */

describe('WASMBackend inverse — exact analytical entries', () => {
  let wasm: WASMBackend;

  beforeAll(async () => {
    wasm = createWASMBackend({ minElements: 0 });
    if (wasm.isAvailable()) await wasm.initialize();
  });

  it('inverse(diag(2,4)) = diag(½, ¼)', async () => {
    if (!wasm.isAvailable()) return; // no AS binary in this environment
    const { inverse, singular } = await wasm.inverse(
      DenseMatrix.fromArray([
        [2, 0],
        [0, 4],
      ])
    );
    expect(singular).toBe(false);
    const inv = inverse.toArray();
    expect(inv[0][0]).toBeCloseTo(0.5, 12);
    expect(inv[1][1]).toBeCloseTo(0.25, 12);
    expect(inv[0][1]).toBeCloseTo(0, 12);
    expect(inv[1][0]).toBeCloseTo(0, 12);
  });

  it('inverse([[4,7],[2,6]]) = (1/10)·[[6,−7],[−2,4]] (det = 10)', async () => {
    if (!wasm.isAvailable()) return;
    const { inverse, singular } = await wasm.inverse(
      DenseMatrix.fromArray([
        [4, 7],
        [2, 6],
      ])
    );
    expect(singular).toBe(false);
    const inv = inverse.toArray();
    expect(inv[0][0]).toBeCloseTo(0.6, 12);
    expect(inv[0][1]).toBeCloseTo(-0.7, 12);
    expect(inv[1][0]).toBeCloseTo(-0.2, 12);
    expect(inv[1][1]).toBeCloseTo(0.4, 12);
  });
});

describe('svdWasm — closed-form singular values', () => {
  it('σ(diag(3,2,1)) = (3,2,1) exactly', async () => {
    const { S } = await svdWasm([
      [3, 0, 0],
      [0, 2, 0],
      [0, 0, 1],
    ]);
    const sv = [...S].sort((a, b) => b - a);
    expect(sv[0]).toBeCloseTo(3, 10);
    expect(sv[1]).toBeCloseTo(2, 10);
    expect(sv[2]).toBeCloseTo(1, 10);
  });

  it('σ([[3,0],[4,5]]) = (3√5, √5) — from eig(AᵀA) = {45, 5}', async () => {
    const { S } = await svdWasm([
      [3, 0],
      [4, 5],
    ]);
    const sv = [...S].sort((a, b) => b - a);
    expect(sv[0]).toBeCloseTo(3 * Math.sqrt(5), 10);
    expect(sv[1]).toBeCloseTo(Math.sqrt(5), 10);
  });
});
