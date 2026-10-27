/**
 * Regression: public DenseMatrix.multiply and lu/qr/cholesky stay on JS;
 * WASM GEMM is only via backendManager / wasmBackend / Tensor.matMul.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { lu } from '../src/operations/lu.js';
import { qr } from '../src/operations/qr.js';
import { cholesky } from '../src/operations/cholesky.js';
import { backendManager, DEFAULT_EXTENDED_HINTS } from '../src/backends/BackendManager.js';
import { wasmBackend } from '../src/backends/WASMBackend.js';
import { backendRegistry, DEFAULT_BACKEND_HINTS } from '../src/backends/Backend.js';
import { DEFAULT_CONFIG, resetConfig, setConfig } from '../src/config.js';

/** Independent ikj matmul oracle (not arithmetic.multiply). */
function ikjMultiply(
  a: Float64Array,
  aRows: number,
  aCols: number,
  b: Float64Array,
  bCols: number
): Float64Array {
  const out = new Float64Array(aRows * bCols);
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aik = a[i * aCols + k];
      if (aik === 0) continue;
      for (let j = 0; j < bCols; j++) {
        out[i * bCols + j] += aik * b[k * bCols + j];
      }
    }
  }
  return out;
}

function installWasmSpies() {
  return {
    multiply: vi.spyOn(wasmBackend, 'multiply'),
    lu: vi.spyOn(wasmBackend, 'luDecomposition'),
    qr: vi.spyOn(wasmBackend, 'qrDecomposition'),
    cholesky: vi.spyOn(wasmBackend, 'choleskyDecomposition'),
    managerMultiply: vi.spyOn(backendManager, 'multiply'),
  };
}

describe('dense JS backend reach', () => {
  let spies: ReturnType<typeof installWasmSpies>;

  beforeEach(() => {
    spies = installWasmSpies();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetConfig();
  });

  describe('DenseMatrix.multiply', () => {
    it('32×32 stays JS with zero WASM/manager calls (flop count 32³ > 256)', () => {
      const n = 32;
      const a = DenseMatrix.random(n, n);
      const b = DenseMatrix.random(n, n);
      const got = a.multiply(b);
      const expected = ikjMultiply(a.toFloat64Array(), n, n, b.toFloat64Array(), n);
      expect(got.toFloat64Array()).toEqual(expected);
      expect(spies.multiply).not.toHaveBeenCalled();
      expect(spies.managerMultiply).not.toHaveBeenCalled();
    });

    it('1×1 multiply', () => {
      const a = DenseMatrix.fromArray([[3]]);
      const b = DenseMatrix.fromArray([[7]]);
      expect(a.multiply(b).get(0, 0)).toBe(21);
      expect(spies.multiply).not.toHaveBeenCalled();
    });

    it('non-square 8×16 × 16×4 with explicit zero in operand', () => {
      const aData = new Float64Array(8 * 16);
      aData.fill(1);
      aData[3 * 16 + 5] = 0;
      const bData = new Float64Array(16 * 4);
      for (let k = 0; k < 16; k++) {
        for (let j = 0; j < 4; j++) bData[k * 4 + j] = k + j;
      }
      const a = DenseMatrix.fromFlat(8, 16, Array.from(aData));
      const b = DenseMatrix.fromFlat(16, 4, Array.from(bData));
      const got = a.multiply(b);
      const expected = ikjMultiply(aData, 8, 16, bData, 4);
      expect(got.toFloat64Array()).toEqual(expected);
      expect(spies.multiply).not.toHaveBeenCalled();
    });
  });

  describe('lu', () => {
    it('3×3 hand-checked P·A = L·U, WASM LU not called', () => {
      const A = DenseMatrix.fromArray([
        [2, 1, 1],
        [4, 3, 3],
        [8, 7, 9],
      ]);
      const { L, U, P } = lu(A);
      const n = 3;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let rhs = 0;
          for (let k = 0; k < n; k++) rhs += L.get(i, k) * U.get(k, j);
          expect(A.get(P[i], j)).toBeCloseTo(rhs, 12);
        }
      }
      expect(spies.lu).not.toHaveBeenCalled();
    });

    it('0×0 empty factors', () => {
      const A = DenseMatrix.zeros(0, 0);
      const { L, U, P } = lu(A);
      expect(L.rows).toBe(0);
      expect(U.cols).toBe(0);
      expect(P).toEqual([]);
      expect(spies.lu).not.toHaveBeenCalled();
    });

    it('singular matrix throws without WASM', () => {
      const A = DenseMatrix.fromArray([
        [1, 1],
        [1, 1],
      ]);
      expect(() => lu(A)).toThrow();
      expect(spies.lu).not.toHaveBeenCalled();
    });
  });

  describe('qr', () => {
    it('4×3: A ≈ Q·R and QᵀQ ≈ I (Gram-Schmidt JS path)', () => {
      const A = DenseMatrix.fromArray([
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 1, 1],
      ]);
      const { Q, R } = qr(A);
      const m = A.rows;
      const n = A.cols;
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
          let recon = 0;
          for (let k = 0; k < n; k++) recon += Q.get(i, k) * R.get(k, j);
          expect(recon).toBeCloseTo(A.get(i, j), 12);
        }
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let dot = 0;
          for (let k = 0; k < m; k++) dot += Q.get(k, i) * Q.get(k, j);
          expect(dot).toBeCloseTo(i === j ? 1 : 0, 12);
        }
      }
      expect(spies.qr).not.toHaveBeenCalled();
    });
  });

  describe('cholesky', () => {
    it('SPD [[4,2],[2,3]] gives L·Lᵀ', () => {
      const A = DenseMatrix.fromArray([
        [4, 2],
        [2, 3],
      ]);
      const { L } = cholesky(A);
      const n = 2;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let llT = 0;
          for (let k = 0; k < n; k++) llT += L.get(i, k) * L.get(j, k);
          expect(llT).toBeCloseTo(A.get(i, j), 12);
        }
      }
      expect(spies.cholesky).not.toHaveBeenCalled();
    });

    it('non-SPD throws without WASM', () => {
      const A = DenseMatrix.fromArray([
        [1, 2],
        [2, 1],
      ]);
      expect(() => cholesky(A)).toThrow();
      expect(spies.cholesky).not.toHaveBeenCalled();
    });
  });

  describe('registry and single threshold table', () => {
    it('gpu backend is not registered on BackendManager', () => {
      expect(backendManager.hasBackend('gpu')).toBe(false);
      expect(backendRegistry.has('gpu')).toBe(false);
    });

    it('DEFAULT_EXTENDED_HINTS matches DEFAULT_CONFIG and DEFAULT_BACKEND_HINTS', () => {
      expect(DEFAULT_EXTENDED_HINTS.operationThresholds.multiply?.wasm).toBe(256);
      expect(DEFAULT_CONFIG.backends.wasm.operationThresholds?.multiply).toBe(256);
      expect(DEFAULT_EXTENDED_HINTS.operationThresholds.transpose?.wasm).toBe(2000);
      expect(DEFAULT_CONFIG.backends.wasm.operationThresholds?.transpose).toBe(2000);
      expect(DEFAULT_EXTENDED_HINTS.operationThresholds.decomposition?.wasm).toBe(100);
      expect(DEFAULT_CONFIG.backends.wasm.operationThresholds?.decomposition).toBe(100);
      expect(DEFAULT_CONFIG.backends.gpu.enabled).toBe(false);
      expect(DEFAULT_EXTENDED_HINTS.operationThresholds.multiply?.gpu).toBe(
        DEFAULT_BACKEND_HINTS.gpuThreshold
      );
      expect(DEFAULT_EXTENDED_HINTS.operationThresholds.transpose?.gpu).toBe(
        DEFAULT_BACKEND_HINTS.gpuThreshold
      );
      expect(DEFAULT_EXTENDED_HINTS.operationThresholds.decomposition?.gpu).toBe(
        DEFAULT_BACKEND_HINTS.gpuThreshold
      );
      expect(DEFAULT_CONFIG.backends.gpu.operationThresholds?.multiply).toBe(
        DEFAULT_BACKEND_HINTS.gpuThreshold
      );
    });

    it('setConfig(debug) does not overwrite measured multiply WASM threshold with stale 500', () => {
      expect(backendManager.getHints().operationThresholds?.multiply?.wasm).toBe(256);
      setConfig({ debug: true });
      expect(backendManager.getHints().operationThresholds?.multiply?.wasm).toBe(256);
    });
  });
});
