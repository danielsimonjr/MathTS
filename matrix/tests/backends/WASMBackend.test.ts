import { describe, it, expect, vi } from 'vitest';
import { WASMBackend, createWASMBackend } from '../../src/backends/WASMBackend.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { jsBackend } from '../../src/backends/JSBackend.js';

describe('WASMBackend', () => {
  it('should initialize with default config', () => {
    const backend = new WASMBackend();
    expect(backend.type).toBe('wasm');
    const config = backend.getConfig();
    expect(config.minElements).toBe(100);
    expect(config.wasmPath).toBe('');
    expect(config.useSIMD).toBe(true);
  });

  it('should allow configuration updates', () => {
    const backend = new WASMBackend();
    backend.updateConfig({ minElements: 50 });
    expect(backend.getConfig().minElements).toBe(50);
  });

  it('createWASMBackend should return a new instance', () => {
    const backend = createWASMBackend({ minElements: 200 });
    expect(backend).toBeInstanceOf(WASMBackend);
    expect(backend.getConfig().minElements).toBe(200);
  });

  it('isAvailable should return a boolean based on WebAssembly presence', () => {
    const backend = new WASMBackend();
    expect(backend.isAvailable()).toBe(typeof WebAssembly !== 'undefined');
  });

  describe('JS Fallback Operations', () => {
    const backend = new WASMBackend({ minElements: 100 });
    const a = new DenseMatrix(2, 2, [[1, 2], [3, 4]]);
    const b = new DenseMatrix(2, 2, [[5, 6], [7, 8]]);

    it('add should fallback to JS', () => {
      const result = backend.add(a, b);
      expect(result.toArray()).toEqual(jsBackend.add(a, b).toArray());
    });

    it('subtract should fallback to JS', () => {
      const result = backend.subtract(a, b);
      expect(result.toArray()).toEqual(jsBackend.subtract(a, b).toArray());
    });

    it('multiplyElementwise should fallback to JS', () => {
      const result = backend.multiplyElementwise(a, b);
      expect(result.toArray()).toEqual(jsBackend.multiplyElementwise(a, b).toArray());
    });

    it('divideElementwise should fallback to JS', () => {
      const result = backend.divideElementwise(a, b);
      expect(result.toArray()).toEqual(jsBackend.divideElementwise(a, b).toArray());
    });

    it('scale should fallback to JS', () => {
      const result = backend.scale(a, 2);
      expect(result.toArray()).toEqual(jsBackend.scale(a, 2).toArray());
    });

    it('abs should fallback to JS', () => {
      const negA = new DenseMatrix(2, 2, [[-1, -2], [-3, -4]]);
      const result = backend.abs(negA);
      expect(result.toArray()).toEqual(jsBackend.abs(negA).toArray());
    });

    it('negate should fallback to JS', () => {
      const result = backend.negate(a);
      expect(result.toArray()).toEqual(jsBackend.negate(a).toArray());
    });

    it('multiply should fallback to JS for sub-threshold matrices', () => {
      const result = backend.multiply(a, b);
      expect(result.toArray()).toEqual(jsBackend.multiply(a, b).toArray());
    });

    it('transpose should fallback to JS', () => {
      const result = backend.transpose(a);
      expect(result.toArray()).toEqual(jsBackend.transpose(a).toArray());
    });

    it('sum should fallback to JS', () => {
      expect(backend.sum(a)).toBe(jsBackend.sum(a));
    });

    it('sumAxis should fallback to JS', () => {
      const result0 = backend.sumAxis(a, 0);
      const result1 = backend.sumAxis(a, 1);
      expect(result0.toArray()).toEqual(jsBackend.sumAxis(a, 0).toArray());
      expect(result1.toArray()).toEqual(jsBackend.sumAxis(a, 1).toArray());
    });

    it('norm should fallback to JS', () => {
      expect(backend.norm(a)).toBe(jsBackend.norm(a));
    });

    it('dot should fallback to JS', () => {
      const v1 = new DenseMatrix(1, 3, [[1, 2, 3]]);
      const v2 = new DenseMatrix(1, 3, [[4, 5, 6]]);
      expect(backend.dot(v1, v2)).toBe(jsBackend.dot(v1, v2));
    });
  });

  describe('Decomposition Fallbacks and Error Handling', () => {
    const backend = new WASMBackend();

    it('luDecomposition should throw on non-square matrix', async () => {
      const a = new DenseMatrix(2, 3, [[1, 2, 3], [4, 5, 6]]);
      await expect(backend.luDecomposition(a)).rejects.toThrow('LU decomposition requires a square matrix');
    });

    it('inverse should throw on non-square matrix', async () => {
      const a = new DenseMatrix(2, 3, [[1, 2, 3], [4, 5, 6]]);
      await expect(backend.inverse(a)).rejects.toThrow('Matrix inverse requires a square matrix');
    });

    it('determinantWasm should throw on non-square matrix', async () => {
      const a = new DenseMatrix(2, 3, [[1, 2, 3], [4, 5, 6]]);
      await expect(backend.determinantWasm(a)).rejects.toThrow('Determinant requires a square matrix');
    });

    it('choleskyDecomposition should throw on non-square matrix', async () => {
      const a = new DenseMatrix(2, 3, [[1, 2, 3], [4, 5, 6]]);
      await expect(backend.choleskyDecomposition(a)).rejects.toThrow('Cholesky decomposition requires a square matrix');
    });

    it('luDecomposition should use JS fallback and mark singular', async () => {
      const singular = new DenseMatrix(2, 2, [[0, 0], [0, 0]]);
      const result = await backend.luDecomposition(singular);
      expect(result.singular).toBe(true);
    });

    it('luDecomposition should use JS fallback for non-singular', async () => {
        const a = new DenseMatrix(2, 2, [[4, 3], [6, 3]]);
        const result = await backend.luDecomposition(a);
        expect(result.singular).toBe(false);
        expect(result.lu.rows).toBe(2);
        expect(result.lu.cols).toBe(2);
    });

    it('qrDecomposition should use JS fallback', async () => {
      const a = new DenseMatrix(3, 2, [[1, 2], [3, 4], [5, 6]]);
      const result = await backend.qrDecomposition(a);
      expect(result.q.rows).toBe(3);
      expect(result.q.cols).toBe(3);
      expect(result.r.rows).toBe(3);
      expect(result.r.cols).toBe(2);
    });

    it('inverse should use JS fallback and mark singular', async () => {
      const singular = new DenseMatrix(2, 2, [[0, 0], [0, 0]]);
      const result = await backend.inverse(singular);
      expect(result.singular).toBe(true);
    });

    it('inverse should use JS fallback for non-singular', async () => {
      const a = new DenseMatrix(2, 2, [[4, 7], [2, 6]]);
      const result = await backend.inverse(a);
      expect(result.singular).toBe(false);
      expect(result.inverse.rows).toBe(2);
    });

    it('determinantWasm should use JS fallback and handle singular matrix', async () => {
      const singular = new DenseMatrix(2, 2, [[0, 0], [0, 0]]);
      const result = await backend.determinantWasm(singular);
      expect(result).toBe(0);
    });

    it('determinantWasm should use JS fallback and return determinant', async () => {
      const a = new DenseMatrix(2, 2, [[4, 6], [3, 8]]);
      const result = await backend.determinantWasm(a);
      expect(result).toBeCloseTo(14);
    });

    it('choleskyDecomposition should use JS fallback and mark non-positive definite', async () => {
      const nonPD = new DenseMatrix(2, 2, [[1, 2], [2, 1]]);
      const result = await backend.choleskyDecomposition(nonPD);
      expect(result.positiveDefinite).toBe(false);
    });

    it('choleskyDecomposition should use JS fallback for positive definite', async () => {
      const pd = new DenseMatrix(2, 2, [[4, 12], [12, 37]]);
      const result = await backend.choleskyDecomposition(pd);
      expect(result.positiveDefinite).toBe(true);
      expect(result.l.rows).toBe(2);
    });
  });

  describe('Module Initialization Failure', () => {
      it('should gracefully fail initialization if path is bad and WebAssembly exists', async () => {
          const originalWarn = console.warn;
          const warnMock = vi.fn();
          console.warn = warnMock;

          const backend = new WASMBackend({ wasmPath: '/bad/path/to/nowhere.wasm' });
          await backend.initialize();

          expect(warnMock).toHaveBeenCalledWith(
              expect.stringContaining('Failed to load AssemblyScript WASM module, falling back to JS:'),
              expect.anything()
          );

          console.warn = originalWarn;
      });
  });
});
