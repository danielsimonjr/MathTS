import { describe, it, expect } from 'vitest';
// Issue #1036 (guard rule for typed arrays). Safe evaluate returns a typed array only as the
// storage of a branded matrix, and only when the array is a plain numeric buffer: a real
// `Float64Array`, `Float32Array` or `Int32Array`, with the exact prototype of its kind, and with
// no own enumerable property other than its indices. Every other typed array is refused at every
// position.
import { sanitizeEvaluateResult } from '../src/utils/safe-result.js';

const BRAND = Symbol.for('mathts.matrix.Matrix');
const REFUSED = /host object/;

class Branded {
  [key: string]: unknown;
  constructor(fields: Record<string, unknown>) {
    Object.assign(this, fields);
  }
}
Object.defineProperty(Branded.prototype, BRAND, { value: true });

class Vec64 extends Float64Array {}
class Vec32 extends Float32Array {}
class VecI32 extends Int32Array {}
class LeakyVec extends Float64Array {
  leak: unknown = process;
}

const withLeak = (): Float64Array => Object.assign(new Float64Array(1), { leak: process });

describe('issue #1036: a typed array passes only as a plain numeric buffer of a branded matrix', () => {
  it('refuses a storage array that carries an own property, under every key', () => {
    expect(() => sanitizeEvaluateResult(new Branded({ data: withLeak() }))).toThrow(REFUSED);
    expect(() => sanitizeEvaluateResult(new Branded({ other: withLeak() }))).toThrow(REFUSED);
    const plainExtra = Object.assign(new Int32Array(2), { note: 'x' });
    expect(() => sanitizeEvaluateResult(new Branded({ idx: plainExtra }))).toThrow(REFUSED);
  });

  it('refuses a subclass instance at the top level, in a container and in a branded matrix', () => {
    for (const sub of [new Vec64(2), new Vec32(2), new VecI32(2), new LeakyVec(1)]) {
      expect(() => sanitizeEvaluateResult(sub)).toThrow(REFUSED);
      expect(() => sanitizeEvaluateResult([sub])).toThrow(REFUSED);
      expect(() => sanitizeEvaluateResult({ a: sub })).toThrow(REFUSED);
      expect(() => sanitizeEvaluateResult(new Branded({ data: sub }))).toThrow(REFUSED);
    }
  });

  it('refuses an array with a changed prototype and a Proxy of an array', () => {
    const reprototyped = Object.setPrototypeOf(new Float64Array(1), Vec64.prototype) as unknown;
    expect(() => sanitizeEvaluateResult(reprototyped)).toThrow(REFUSED);
    expect(() => sanitizeEvaluateResult(new Branded({ data: reprototyped }))).toThrow(REFUSED);
    const proxy = new Proxy(new Float64Array(1), { get: () => process });
    expect(() => sanitizeEvaluateResult(new Branded({ data: proxy }))).toThrow(REFUSED);
  });

  it('refuses a typed array of another kind in a branded matrix', () => {
    for (const other of [new Uint8Array(1), new Int16Array(1), new BigInt64Array(1)]) {
      expect(() => sanitizeEvaluateResult(new Branded({ data: other }))).toThrow(REFUSED);
    }
    expect(() =>
      sanitizeEvaluateResult(new Branded({ data: new DataView(new ArrayBuffer(8)) }))
    ).toThrow(REFUSED);
  });

  it('accepts the three storage kinds in a branded matrix, empty arrays and views included (pin)', () => {
    const fields = {
      data: new Float64Array([1, 2]),
      single: new Float32Array(2),
      idx: new Int32Array(0),
      view: new Float64Array(8).subarray(2, 4),
    };
    const matrix = new Branded(fields);
    expect(sanitizeEvaluateResult(matrix)).toBe(matrix);
  });

  it('refuses an exact typed array at the top level and in an object with no brand (pin)', () => {
    expect(() => sanitizeEvaluateResult(new Float64Array(2))).toThrow(REFUSED);
    expect(() => sanitizeEvaluateResult([new Float64Array(2)])).toThrow(REFUSED);
    expect(() => sanitizeEvaluateResult({ a: new Int32Array(2) })).toThrow(REFUSED);
  });
});

// The member-access receiver allowlist (`isSandboxReceiver` in customs.ts) used the same
// `instanceof` rule, so a method of a typed-array subclass ran from an expression, although a
// method of any other class instance is refused as a host object. One rule serves both checks.
describe('issue #1036: the receiver allowlist takes a typed array only as a plain numeric buffer', () => {
  class MethodVec extends Float64Array {
    leak(): string {
      return 'host method ran';
    }
  }

  it('refuses a typed-array subclass, a changed prototype and a Proxy as a receiver', async () => {
    const { isSandboxReceiver } = await import('../src/utils/customs.js');
    expect(isSandboxReceiver(new MethodVec(2))).toBe(false);
    const reprototyped = Object.setPrototypeOf(new Float64Array(1), MethodVec.prototype) as unknown;
    expect(isSandboxReceiver(reprototyped)).toBe(false);
    expect(isSandboxReceiver(new Proxy(new Float64Array(1), {}))).toBe(false);
  });

  it('keeps an exact storage array as a receiver (pin)', async () => {
    const { isSandboxReceiver } = await import('../src/utils/customs.js');
    for (const v of [new Float64Array(2), new Float32Array(1), new Int32Array(0)]) {
      expect(isSandboxReceiver(v)).toBe(true);
    }
    // The receiver test is O(1) (it reads no own keys), so an own property does not change it;
    // `isSafeProperty` and `isSafeMethod` govern own members, as for a plain object.
    expect(isSandboxReceiver(Object.assign(new Float64Array(1), { note: 1 }))).toBe(true);
  });
});
