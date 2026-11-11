import { describe, expect, it } from 'vitest';
import { mat3MulVec, mat3ToQuat, mat4Compose, mat4Decompose, quatRotate } from '../src/index.js';

/** Upper 3x3 of a column-major 4x4 matrix, as a column-major 3x3 matrix. */
function upper3(m4: Float64Array): Float64Array {
  return Float64Array.of(m4[0]!, m4[1]!, m4[2]!, m4[4]!, m4[5]!, m4[6]!, m4[8]!, m4[9]!, m4[10]!);
}

function rotationOf(q: readonly number[]): Float64Array {
  const m4 = new Float64Array(16);
  mat4Compose(m4, [0, 0, 0], q, [1, 1, 1]);
  return upper3(m4);
}

function unit(q: number[]): number[] {
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

// One quaternion per Shepperd branch: trace > 0, then m11, m22 and m33 largest.
const BRANCHES: Record<string, number[]> = {
  trace: unit([0.9, 0.1, -0.2, 0.3]),
  m11: unit([0.1, 0.9, 0.2, -0.3]),
  m22: unit([0.1, -0.2, 0.9, 0.3]),
  m33: unit([0.1, 0.3, -0.2, 0.9]),
};

describe('mat3ToQuat', () => {
  it('writes the identity quaternion for the identity matrix', () => {
    const out = new Float64Array(4);
    expect(mat3ToQuat(out, [1, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(out);
    expect(Array.from(out)).toEqual([1, 0, 0, 0]);
  });

  for (const [branch, q] of Object.entries(BRANCHES)) {
    it(`recovers q or -q in the ${branch} branch`, () => {
      const out = new Float64Array(4);
      mat3ToQuat(out, rotationOf(q));
      const sign = Math.sign(out[0]! * q[0]! + out[1]! * q[1]! + out[2]! * q[2]! + out[3]! * q[3]!);
      for (let i = 0; i < 4; i++) expect(out[i]! * sign).toBeCloseTo(q[i]!, 14);
    });

    it(`matches mat4Decompose bit for bit in the ${branch} branch`, () => {
      const m4 = new Float64Array(16);
      mat4Compose(m4, [0, 0, 0], q, [1, 1, 1]);
      const p = new Float64Array(3);
      const s = new Float64Array(3);
      const viaDecompose = new Float64Array(4);
      mat4Decompose(p, viaDecompose, s, m4);
      // mat4Decompose divides each column by its length (within an ulp of 1, not 1).
      const m3 = upper3(m4);
      for (let j = 0; j < 9; j++) m3[j] = m3[j]! * (1 / s[Math.floor(j / 3)]!);
      const out = new Float64Array(4);
      mat3ToQuat(out, m3);
      expect(Array.from(out)).toEqual(Array.from(viaDecompose));
    });

    it(`rotates a vector as the matrix does in the ${branch} branch`, () => {
      const m = rotationOf(q);
      const qq = new Float64Array(4);
      mat3ToQuat(qq, m);
      const v = [0.3, -1.7, 2.2];
      const a = new Float64Array(3);
      const b = new Float64Array(3);
      mat3MulVec(a, m, v);
      quatRotate(b, qq, v);
      for (let i = 0; i < 3; i++) expect(b[i]).toBeCloseTo(a[i]!, 13);
    });
  }

  it('reads and writes at offsets, and may write over its input', () => {
    const m = rotationOf(BRANCHES.m22!);
    const expected = new Float64Array(4);
    mat3ToQuat(expected, m);

    const buf = new Float64Array(2 + 9);
    buf.set(m, 2);
    const out = new Float64Array(5);
    mat3ToQuat(out, buf, 1, 2);
    expect(out[0]).toBe(0);
    expect(Array.from(out.subarray(1))).toEqual(Array.from(expected));

    // Output over the first cells of the input.
    mat3ToQuat(buf, buf, 2, 2);
    expect(Array.from(buf.subarray(2, 6))).toEqual(Array.from(expected));
  });
});
