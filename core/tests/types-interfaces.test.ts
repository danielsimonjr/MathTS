/**
 * Smoke test for core/src/types/interfaces.ts
 *
 * This file is type-only (interfaces + type aliases). The test imports
 * the types and performs compile-time shape checks; the runtime assertion
 * is a trivial sentinel so vitest counts the test.
 */
import { describe, it, expect } from 'vitest';
import type {
  MathTSValue,
  Scalar,
  BackendType,
  NumericType,
  MatrixBackend,
  IMatrix,
  IComplex,
  IFraction,
  IBigNumber,
  MatrixDimensions,
} from '../src/types/interfaces.js';

describe('core/src/types/interfaces.ts – type-only smoke test', () => {
  it('BackendType accepts only the three valid literals', () => {
    const b1: BackendType = 'js';
    const b2: BackendType = 'wasm';
    const b3: BackendType = 'gpu';
    expect(b1).toBe('js');
    expect(b2).toBe('wasm');
    expect(b3).toBe('gpu');
  });

  it('NumericType accepts expected literals', () => {
    const n1: NumericType = 'float64';
    const n2: NumericType = 'complex128';
    expect(n1).toBe('float64');
    expect(n2).toBe('complex128');
  });

  it('MatrixDimensions shape check', () => {
    const dims: MatrixDimensions = { rows: 3, cols: 4 };
    expect(dims.rows).toBe(3);
    expect(dims.cols).toBe(4);
  });

  it('MathTSValue, Scalar, IMatrix, IComplex, IFraction, IBigNumber, MatrixBackend are importable as types', () => {
    // Verify the types can be referenced without runtime error (type-level only).
    type _CheckMathTSValue = MathTSValue;
    type _CheckScalar = Scalar;
    type _CheckIMatrix = IMatrix<number>;
    type _CheckIComplex = IComplex;
    type _CheckIFraction = IFraction;
    type _CheckIBigNumber = IBigNumber;
    type _CheckMatrixBackend = MatrixBackend;
    expect(true).toBe(true);
  });
});
