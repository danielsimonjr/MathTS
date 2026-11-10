/**
 * Quaternion module: convention pins, one block for each exported function,
 * and round trips between axis-angle, quaternion, rotation matrix and Euler
 * angles. The conventions are stated in `src/geometry/quaternion.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  quaternionMultiply,
  quaternionConjugate,
  quaternionNormalize,
  quaternionFromAxisAngle,
  quaternionRotate,
  quaternionToRotationMatrix,
  quaternionInverse,
  quaternionSlerp,
  quaternionToEuler,
  quaternionLog,
  quaternionExp,
  quaternionPow,
} from '../src/index.js';

const close = (a: readonly number[], b: readonly number[], digits = 12): void => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
};
const dot4 = (a: readonly number[], b: readonly number[]): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
const mag = (a: readonly number[]): number => Math.sqrt(a.reduce((s, v) => s + v * v, 0));
/** `q` and `-q` are the same rotation: compare unit quaternions up to sign. */
const sameRotation = (a: readonly number[], b: readonly number[], tol = 1e-12): void => {
  expect(Math.abs(Math.abs(dot4(a, b)) - 1)).toBeLessThan(tol);
};
const matVec = (m: readonly number[][], v: readonly number[]): number[] =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
/** Rodrigues rotation matrix for a unit axis `k` and an angle. */
const rodrigues = (k: readonly number[], angle: number): number[][] => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [x, y, z] = k;
  return [
    [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
    [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
    [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)],
  ];
};
const unit = (v: readonly number[]): number[] => v.map((c) => c / mag(v));
/** ZYX Euler angles to a quaternion, built from the public functions only. */
const fromEuler = (roll: number, pitch: number, yaw: number): number[] =>
  quaternionMultiply(
    quaternionMultiply(
      quaternionFromAxisAngle([0, 0, 1], yaw),
      quaternionFromAxisAngle([0, 1, 0], pitch)
    ),
    quaternionFromAxisAngle([1, 0, 0], roll)
  );

const I = [0, 1, 0, 0];
const J = [0, 0, 1, 0];
const K = [0, 0, 0, 1];
const AXES: number[][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  unit([1, 1, 1]),
  unit([1, 1, 0]),
  unit([1, -2, 3]),
];
const ANGLES = [0, 1e-8, 0.3, Math.PI / 2, (2 * Math.PI) / 3, Math.PI, (3 * Math.PI) / 2];

describe('quaternion convention', () => {
  it('uses the Hamilton product: ij = k, jk = i, ki = j, ji = -k', () => {
    close(quaternionMultiply(I, J), K);
    close(quaternionMultiply(J, K), I);
    close(quaternionMultiply(K, I), J);
    close(quaternionMultiply(J, I), [0, 0, 0, -1]);
    close(quaternionMultiply(I, I), [-1, 0, 0, 0]);
  });

  it('is scalar first: the identity is [1, 0, 0, 0]', () => {
    close(quaternionFromAxisAngle([0, 0, 1], 0), [1, 0, 0, 0]);
    close(quaternionMultiply([1, 0, 0, 0], [0.5, 0.5, 0.5, 0.5]), [0.5, 0.5, 0.5, 0.5]);
  });

  it('rotates actively by the right-hand rule: +90 degrees about z takes x to y', () => {
    const q = quaternionFromAxisAngle([0, 0, 1], Math.PI / 2);
    close(quaternionRotate(q, [1, 0, 0]), [0, 1, 0]);
    close(quaternionRotate(q, [0, 1, 0]), [-1, 0, 0]);
  });

  it('gives a matrix that acts on column vectors and agrees with quaternionRotate', () => {
    const v = [0.3, -1.2, 2.5];
    for (const axis of AXES) {
      for (const angle of ANGLES) {
        const q = quaternionFromAxisAngle(axis, angle);
        close(matVec(quaternionToRotationMatrix(q), v), quaternionRotate(q, v));
      }
    }
  });

  it('composes left to right as "apply the right factor first"', () => {
    const a = quaternionFromAxisAngle([0, 0, 1], 0.7);
    const b = quaternionFromAxisAngle([1, 0, 0], -0.4);
    const v = [1, 2, 3];
    close(
      quaternionRotate(quaternionMultiply(a, b), v),
      quaternionRotate(a, quaternionRotate(b, v))
    );
  });
});

describe('quaternionMultiply / quaternionConjugate / quaternionInverse', () => {
  it('conjugate negates the vector part', () => {
    expect(quaternionConjugate([1, 2, 3, 4])).toEqual([1, -2, -3, -4]);
  });

  it('q times its inverse is the identity for a non-unit quaternion', () => {
    const q = [1, 2, 3, 4];
    close(quaternionMultiply(q, quaternionInverse(q)), [1, 0, 0, 0]);
    close(quaternionMultiply(quaternionInverse(q), q), [1, 0, 0, 0]);
  });

  it('inverse throws on the zero quaternion', () => {
    expect(() => quaternionInverse([0, 0, 0, 0])).toThrow(/zero/i);
  });

  it('the product is associative and its norm is the product of the norms', () => {
    const a = [1, 2, 3, 4];
    const b = [-0.5, 0.25, 2, 1];
    const c = [0.1, -3, 0.7, 2];
    close(
      quaternionMultiply(quaternionMultiply(a, b), c),
      quaternionMultiply(a, quaternionMultiply(b, c))
    );
    expect(mag(quaternionMultiply(a, b))).toBeCloseTo(mag(a) * mag(b), 12);
  });
});

describe('quaternionNormalize', () => {
  it('returns a unit quaternion with the same direction', () => {
    close(quaternionNormalize([2, 0, 0, 0]), [1, 0, 0, 0]);
    expect(mag(quaternionNormalize([1, 2, 3, 4]))).toBeCloseTo(1, 14);
  });

  it('throws on the zero quaternion', () => {
    expect(() => quaternionNormalize([0, 0, 0, 0])).toThrow(/zero/i);
  });
});

describe('quaternionFromAxisAngle', () => {
  it('normalises the axis', () => {
    close(quaternionFromAxisAngle([0, 0, 5], Math.PI / 2), [Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  });

  it('returns a unit quaternion for each axis and angle', () => {
    for (const axis of AXES) {
      for (const angle of ANGLES) {
        expect(mag(quaternionFromAxisAngle(axis, angle))).toBeCloseTo(1, 14);
      }
    }
  });

  it('throws on a zero axis, at a non-zero angle and at angle 0', () => {
    expect(() => quaternionFromAxisAngle([0, 0, 0], 1)).toThrow(/axis/i);
    expect(() => quaternionFromAxisAngle([0, 0, 0], 0)).toThrow(/axis/i);
  });

  it('throws on an axis that is not finite', () => {
    expect(() => quaternionFromAxisAngle([NaN, 0, 1], 1)).toThrow(/axis/i);
    expect(() => quaternionFromAxisAngle([Infinity, 0, 0], 1)).toThrow(/axis/i);
  });
});

describe('quaternionRotate / quaternionToRotationMatrix', () => {
  it('a non-unit quaternion gives the same rotation as its unit form', () => {
    const q = quaternionFromAxisAngle([1, -2, 3], 0.9);
    const scaled = q.map((c) => c * 3);
    const v = [0.5, 1.5, -2];
    close(quaternionRotate(scaled, v), quaternionRotate(q, v));
    const m = quaternionToRotationMatrix(scaled);
    const expected = quaternionToRotationMatrix(q);
    m.forEach((row, i) => close(row, expected[i]));
  });

  it('both throw on the zero quaternion', () => {
    expect(() => quaternionRotate([0, 0, 0, 0], [1, 0, 0])).toThrow(/zero/i);
    expect(() => quaternionToRotationMatrix([0, 0, 0, 0])).toThrow(/zero/i);
  });

  it('the rotation keeps the length of the vector', () => {
    const q = quaternionFromAxisAngle([2, 1, -1], 2.2);
    expect(mag(quaternionRotate(q, [3, 4, 12]))).toBeCloseTo(13, 12);
  });

  it('the matrix is orthogonal with determinant +1', () => {
    const m = quaternionToRotationMatrix(quaternionFromAxisAngle([1, 2, 3], 1.1));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const d = m[i][0] * m[j][0] + m[i][1] * m[j][1] + m[i][2] * m[j][2];
        expect(d).toBeCloseTo(i === j ? 1 : 0, 12);
      }
    }
    const det =
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    expect(det).toBeCloseTo(1, 12);
  });
});

describe('quaternionSlerp', () => {
  const a = quaternionFromAxisAngle([0, 0, 1], 0.2);
  const b = quaternionFromAxisAngle([0, 0, 1], 1.4);

  it('returns the end points at t = 0 and t = 1', () => {
    close(quaternionSlerp(a, b, 0), a);
    close(quaternionSlerp(a, b, 1), b);
  });

  it('moves at a constant angular rate about a fixed axis', () => {
    close(quaternionSlerp(a, b, 0.25), quaternionFromAxisAngle([0, 0, 1], 0.5));
    close(quaternionSlerp(a, b, 0.5), quaternionFromAxisAngle([0, 0, 1], 0.8));
  });

  it('takes the shortest arc when the dot product is negative', () => {
    const negB = b.map((c) => -c);
    sameRotation(quaternionSlerp(a, negB, 0.5), quaternionFromAxisAngle([0, 0, 1], 0.8));
  });

  it('returns a unit quaternion for inputs that are not unit', () => {
    const r = quaternionSlerp(
      a.map((c) => c * 2),
      b.map((c) => c * 5),
      0.5
    );
    expect(mag(r)).toBeCloseTo(1, 12);
    close(r, quaternionFromAxisAngle([0, 0, 1], 0.8));
  });

  it('returns a unit quaternion on the nearly parallel branch', () => {
    const near = quaternionFromAxisAngle([0, 0, 1], 0.2 + 1e-6);
    const r = quaternionSlerp(a, near, 0.5);
    expect(mag(r)).toBeCloseTo(1, 14);
    // 10 digits: the two end points differ in the 8th digit, so an end point fails.
    close(r, quaternionFromAxisAngle([0, 0, 1], 0.2 + 5e-7), 10);
  });

  it('throws on a zero quaternion', () => {
    expect(() => quaternionSlerp([0, 0, 0, 0], b, 0.5)).toThrow(/zero/i);
    expect(() => quaternionSlerp(a, [0, 0, 0, 0], 0.5)).toThrow(/zero/i);
  });
});

describe('quaternionLog / quaternionExp / quaternionPow', () => {
  it('log of a unit quaternion is the half-angle times the axis', () => {
    const axis = unit([1, -2, 3]);
    const q = quaternionFromAxisAngle(axis, 1.3);
    close(quaternionLog(q), [0, ...axis.map((c) => c * 0.65)]);
  });

  it('exp(log(q)) returns q for unit and non-unit quaternions', () => {
    const samples = [
      quaternionFromAxisAngle([1, 0, 0], Math.PI / 3),
      quaternionFromAxisAngle([1, 1, 1], 2.5),
      [1, 2, 3, 4],
      [-0.5, 0.25, 2, 1],
      [3, 0, 0, 0],
    ];
    for (const q of samples) close(quaternionExp(quaternionLog(q)), q);
  });

  it('log keeps the magnitude in the scalar part', () => {
    expect(quaternionLog([Math.E, 0, 0, 0])[0]).toBeCloseTo(1, 14);
    expect(quaternionLog([0, 2, 0, 0])[0]).toBeCloseTo(Math.log(2), 14);
  });

  it('log throws on the zero quaternion', () => {
    expect(() => quaternionLog([0, 0, 0, 0])).toThrow(/zero/i);
  });

  it('log has no jump near w = -1: a rotation by 2 pi keeps its axis', () => {
    const full = quaternionFromAxisAngle([0, 0, 1], 2 * Math.PI);
    close(quaternionLog(full), [0, 0, 0, Math.PI]);
    close(quaternionPow(full, 0.5), [0, 0, 0, 1]);
  });

  it('log of a quaternion with an exactly zero vector part has a zero vector part', () => {
    expect(quaternionLog([-1, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    expect(quaternionLog([1, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it('exp of a pure quaternion is a unit quaternion', () => {
    expect(mag(quaternionExp([0, 0.3, -1.1, 2]))).toBeCloseTo(1, 14);
    close(quaternionExp([1, 0, 0, 0]), [Math.E, 0, 0, 0]);
  });

  it('pow multiplies the angle and keeps the axis', () => {
    const axis = unit([1, 1, 0]);
    const q = quaternionFromAxisAngle(axis, 0.8);
    close(quaternionPow(q, 0.5), quaternionFromAxisAngle(axis, 0.4));
    close(quaternionPow(q, 2), quaternionMultiply(q, q));
    close(quaternionPow(q, -1), quaternionInverse(q));
    close(quaternionPow(q, 0), [1, 0, 0, 0]);
  });

  it('pow of a non-unit quaternion agrees with repeated multiplication', () => {
    const q = [1, 2, 3, 4];
    close(quaternionPow(q, 2), quaternionMultiply(q, q), 10);
    close(quaternionPow(q, -1), quaternionInverse(q));
  });
});

describe('quaternionToEuler', () => {
  it('reads single-axis rotations as [roll, pitch, yaw]', () => {
    close(quaternionToEuler(quaternionFromAxisAngle([1, 0, 0], 0.4)), [0.4, 0, 0]);
    close(quaternionToEuler(quaternionFromAxisAngle([0, 1, 0], 0.4)), [0, 0.4, 0]);
    close(quaternionToEuler(quaternionFromAxisAngle([0, 0, 1], 0.4)), [0, 0, 0.4]);
  });

  it('gives the same angles for a non-unit quaternion', () => {
    const q = fromEuler(0.3, -0.5, 1.1);
    close(quaternionToEuler(q.map((c) => c * 4)), [0.3, -0.5, 1.1]);
  });

  it('throws on the zero quaternion', () => {
    expect(() => quaternionToEuler([0, 0, 0, 0])).toThrow(/zero/i);
  });
});

describe('quaternion round trips', () => {
  it('axis-angle to quaternion and back through the logarithm', () => {
    for (const axis of AXES) {
      for (const angle of [1e-8, 0.3, Math.PI / 2, (2 * Math.PI) / 3, Math.PI]) {
        const log = quaternionLog(quaternionFromAxisAngle(axis, angle));
        const half = mag(log.slice(1));
        expect(2 * half).toBeCloseTo(angle, 12);
        close(
          log.slice(1).map((c) => c / half),
          axis,
          7
        );
      }
    }
  });

  it('an angle above pi comes back as the same rotation', () => {
    const q = quaternionFromAxisAngle([0, 0, 1], (3 * Math.PI) / 2);
    expect(q[0]).toBeLessThan(0);
    sameRotation(quaternionExp(quaternionLog(q)), q);
    sameRotation(q, quaternionFromAxisAngle([0, 0, -1], Math.PI / 2));
  });

  it('quaternion to matrix agrees with the Rodrigues formula', () => {
    for (const axis of AXES) {
      for (const angle of ANGLES) {
        const m = quaternionToRotationMatrix(quaternionFromAxisAngle(axis, angle));
        const expected = rodrigues(axis, angle);
        m.forEach((row, i) => close(row, expected[i]));
      }
    }
  });

  it('Euler angles to quaternion and back, away from gimbal lock', () => {
    const cases: [number, number, number][] = [
      [0.3, 0.2, 0.7],
      [-2.5, -1.2, 3.0],
      [1.0, 1.4, -2.0],
      [3.0, -0.01, -3.0],
    ];
    for (const [roll, pitch, yaw] of cases) {
      close(quaternionToEuler(fromEuler(roll, pitch, yaw)), [roll, pitch, yaw], 10);
    }
  });

  it('near gimbal lock the angles still round-trip, at the precision of asin', () => {
    const pitch = Math.PI / 2 - 1e-4;
    const e = quaternionToEuler(fromEuler(0.3, pitch, 0.7));
    expect(Math.abs(e[0] - 0.3)).toBeLessThan(1e-7);
    expect(Math.abs(e[1] - pitch)).toBeLessThan(1e-7);
    expect(Math.abs(e[2] - 0.7)).toBeLessThan(1e-7);
  });

  it('at gimbal lock the angles rebuild the same rotation and roll is 0', () => {
    for (const pitch of [Math.PI / 2, -Math.PI / 2]) {
      const q = fromEuler(0.3, pitch, 0.7);
      const [roll, p, yaw] = quaternionToEuler(q);
      expect(roll).toBe(0);
      expect(p).toBeCloseTo(pitch, 12);
      sameRotation(fromEuler(roll, p, yaw), q, 1e-10);
    }
  });

  it('a pitch outside [-pi/2, pi/2] comes back as the same rotation', () => {
    const q = fromEuler(0.4, 2.0, -0.9);
    const [roll, pitch, yaw] = quaternionToEuler(q);
    expect(Math.abs(pitch)).toBeLessThanOrEqual(Math.PI / 2);
    sameRotation(fromEuler(roll, pitch, yaw), q);
  });

  it('quaternion to matrix to vector agrees with the Euler rebuild', () => {
    const q = fromEuler(0.3, -0.5, 1.1);
    const [roll, pitch, yaw] = quaternionToEuler(q);
    const v = [1, -2, 0.5];
    close(
      matVec(quaternionToRotationMatrix(fromEuler(roll, pitch, yaw)), v),
      quaternionRotate(q, v)
    );
  });
});

describe('quaternion magnitude range', () => {
  const unitQ = quaternionFromAxisAngle([1, -2, 3], 0.9);
  const v = [0.5, 1.5, -2];
  const SCALES = [1e-200, 1e-170, 1e160, 1e200];

  it('the rotation functions give the unit-form result at each scale', () => {
    for (const k of SCALES) {
      const q = unitQ.map((c) => c * k);
      close(quaternionNormalize(q), unitQ);
      close(quaternionRotate(q, v), quaternionRotate(unitQ, v));
      const m = quaternionToRotationMatrix(q);
      const expected = quaternionToRotationMatrix(unitQ);
      m.forEach((row, i) => close(row, expected[i]));
      close(quaternionToEuler(q), quaternionToEuler(unitQ));
      close(quaternionSlerp(q, [k, 0, 0, 0], 0.5), quaternionSlerp(unitQ, [1, 0, 0, 0], 0.5));
    }
  });

  it('the inverse times the quaternion is the identity at each scale', () => {
    for (const k of SCALES) {
      const q = unitQ.map((c) => c * k);
      close(quaternionMultiply(q, quaternionInverse(q)), [1, 0, 0, 0]);
    }
  });

  it('log keeps ln|q| and the half angle at each scale', () => {
    const unitLog = quaternionLog(unitQ);
    for (const k of SCALES) {
      const log = quaternionLog(unitQ.map((c) => c * k));
      expect(log[0]).toBeCloseTo(Math.log(k), 10);
      close(log.slice(1), unitLog.slice(1));
    }
  });

  it('the axis of quaternionFromAxisAngle can have each scale', () => {
    for (const k of SCALES) {
      close(quaternionFromAxisAngle([k, -2 * k, 3 * k], 0.9), unitQ);
    }
  });

  it('exp accepts a very small vector part', () => {
    close(quaternionExp([0, 1e-200, 0, 0]), [1, 1e-200, 0, 0]);
  });

  it('each function throws on a quaternion that is not finite', () => {
    for (const bad of [
      [NaN, 0, 0, 1],
      [Infinity, 0, 0, 0],
      [1, 0, -Infinity, 0],
    ]) {
      expect(() => quaternionNormalize(bad)).toThrow(/finite/i);
      expect(() => quaternionInverse(bad)).toThrow(/finite/i);
      expect(() => quaternionRotate(bad, v)).toThrow(/finite/i);
      expect(() => quaternionToRotationMatrix(bad)).toThrow(/finite/i);
      expect(() => quaternionToEuler(bad)).toThrow(/finite/i);
      expect(() => quaternionLog(bad)).toThrow(/finite/i);
      expect(() => quaternionSlerp(bad, unitQ, 0.5)).toThrow(/finite/i);
    }
  });
});
