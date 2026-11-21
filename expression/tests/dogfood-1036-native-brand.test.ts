import { describe, it, expect } from 'vitest';
// Issue #1036: `sanitizeEvaluateResult` must accept an object that carries the registry brand of
// the matrix package, and the typed arrays inside it. The expression package does not import the
// matrix package, so each input is built by hand with the brand on a class prototype.
import { sanitizeEvaluateResult } from '../src/utils/safe-result.js';

const BRAND = Symbol.for('mathts.matrix.Matrix');

function brandPrototype(cls: { prototype: object }, value: unknown = true): void {
  Object.defineProperty(cls.prototype, BRAND, { value });
}

class Branded {
  data = new Float64Array([1, 2]);
  idx = new Int32Array([0]);
}
brandPrototype(Branded);

class Unbranded {
  data = new Float64Array([1, 2]);
  idx = new Int32Array([0]);
}

class BrandValueOne {
  data = new Float64Array([1, 2]);
}
brandPrototype(BrandValueOne, 1);

class BrandedFloat32 {
  data = new Float32Array([1, 2]);
}
brandPrototype(BrandedFloat32);

class BrandedBytes {
  data = new Uint8Array([1, 2]);
}
brandPrototype(BrandedBytes);

class BrandedView {
  data = new DataView(new ArrayBuffer(8));
}
brandPrototype(BrandedView);

class BrandedLeak {
  data = new Float64Array([1]);
  leak: unknown = process;
}
brandPrototype(BrandedLeak);

describe('issue #1036: sanitizeEvaluateResult and the matrix brand', () => {
  it('returns a branded object whose fields are typed arrays', () => {
    const x = new Branded();
    expect(sanitizeEvaluateResult(x)).toBe(x);
  });

  it('accepts a Float32Array field of a branded object', () => {
    const x = new BrandedFloat32();
    expect(sanitizeEvaluateResult(x)).toBe(x);
  });

  it('refuses the same class without the brand', () => {
    expect(() => sanitizeEvaluateResult(new Unbranded())).toThrow(/host object/);
  });

  it('refuses a branded object with a host reference field', () => {
    expect(() => sanitizeEvaluateResult(new BrandedLeak())).toThrow(/host object/);
    const x = new BrandedLeak();
    x.leak = globalThis;
    expect(() => sanitizeEvaluateResult(x)).toThrow(/host object/);
  });

  it('refuses a brand whose value is not true', () => {
    expect(() => sanitizeEvaluateResult(new BrandValueOne())).toThrow(/host object/);
  });

  it('refuses a Uint8Array or a DataView field, also in a branded object', () => {
    expect(() => sanitizeEvaluateResult(new BrandedBytes())).toThrow(/host object/);
    expect(() => sanitizeEvaluateResult(new BrandedView())).toThrow(/host object/);
  });

  it('still refuses a typed array at the top level (pin)', () => {
    expect(() => sanitizeEvaluateResult(new Float64Array(2))).toThrow(/host object/);
    expect(() => sanitizeEvaluateResult(new Float32Array(2))).toThrow(/host object/);
    expect(() => sanitizeEvaluateResult(new Int32Array(2))).toThrow(/host object/);
    expect(() => sanitizeEvaluateResult(Buffer.from('a'))).toThrow(/host object/);
  });

  it('still refuses a typed array in an unbranded container (pin)', () => {
    expect(() => sanitizeEvaluateResult({ a: new Float64Array(1) })).toThrow(/host object/);
    expect(() => sanitizeEvaluateResult([new Float64Array(1)])).toThrow(/host object/);
  });
});
