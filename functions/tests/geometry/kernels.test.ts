/**
 * Allocation-free fixed-size kernels (issue 375): each kernel against its
 * allocating twin, or against a named oracle where no twin exists. Also
 * aliasing, offsets and degenerate inputs. The zero-allocation check is a
 * separate Node-only test (tools/test/kernels-alloc.test.mjs).
 */
import { describe, expect, it } from 'vitest';
import * as F from '../../src/index.js';

type Arr = number[];
const K = F as unknown as Record<string, (...args: unknown[]) => unknown>;

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f64 = new Float64Array(1);
const u64 = new BigUint64Array(f64.buffer);
function bits(x: number): bigint {
  f64[0] = x;
  return u64[0]!;
}

/** Distance in units in the last place. +0 and -0 are equal; NaN equals NaN. */
function ulpDistance(a: number, b: number): number {
  if (a === b) return 0;
  if (Number.isNaN(a) && Number.isNaN(b)) return 0;
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  if (Math.sign(a) !== Math.sign(b)) return Infinity;
  const d = bits(a) - bits(b);
  return Number(d < 0n ? -d : d);
}

function expectUlp(actual: ArrayLike<number>, expected: ArrayLike<number>, max = 0): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const d = ulpDistance(actual[i]!, expected[i]!);
    if (d > max) {
      throw new Error(`component ${i}: ${actual[i]} vs ${expected[i]} (${d} ulp > ${max})`);
    }
  }
}

const N = 10_000;
const rng = mulberry32(0x375);
const r = (): number => (rng() - 0.5) * 20;
const vec = (n: number): Arr => Array.from({ length: n }, r);

/** Column-major flat 3x3 to the twin's row arrays. */
function rows(m: Arr): Arr[] {
  return [0, 1, 2].map((i) => [m[i]!, m[3 + i]!, m[6 + i]!]);
}
function flat(rowsM: Arr[]): Arr {
  const out: Arr = [];
  for (let c = 0; c < 3; c++) for (let i = 0; i < 3; i++) out.push(rowsM[i]![c]!);
  return out;
}

/** The `length` formula of geometry/quaternion.ts, inlined as the oracle. */
function lengthOracle(v: Arr): number {
  let s = 0;
  for (const x of v) s += x * x;
  return s > 1e-280 && s < 1e280 ? Math.sqrt(s) : Math.hypot(...v);
}

const mulAll = (s: number, v: Arr): Arr => F.multiply(s, v) as Arr;

/** Each case: kernel name, input sizes, scalar count, result size (0 = scalar), oracle. */
interface Case {
  name: string;
  sizes: number[];
  scalars: number;
  outSize: number;
  oracle: (arrays: Arr[], s: number[]) => Arr | number;
  ulp?: number;
}

const cases: Case[] = [
  ...[2, 3].flatMap((n): Case[] => [
    {
      name: `vec${n}Add`,
      sizes: [n, n],
      scalars: 0,
      outSize: n,
      oracle: ([a, b]) => F.add(a, b) as Arr,
    },
    {
      name: `vec${n}Sub`,
      sizes: [n, n],
      scalars: 0,
      outSize: n,
      oracle: ([a, b]) => F.subtract(a, b) as Arr,
    },
    {
      name: `vec${n}Scale`,
      sizes: [n],
      scalars: 1,
      outSize: n,
      oracle: ([a], [s]) => mulAll(s!, a!),
    },
    {
      name: `vec${n}ScaleAndAdd`,
      sizes: [n, n],
      scalars: 1,
      outSize: n,
      oracle: ([a, b], [s]) => a!.map((x, i) => x + s! * b![i]!),
    },
    {
      name: `vec${n}Dot`,
      sizes: [n, n],
      scalars: 0,
      outSize: 0,
      oracle: ([a, b]) => F.dot(a, b) as number,
    },
    {
      name: `vec${n}Length`,
      sizes: [n],
      scalars: 0,
      outSize: 0,
      oracle: ([a]) => lengthOracle(a!),
    },
    {
      name: `vec${n}Normalize`,
      sizes: [n],
      scalars: 0,
      outSize: n,
      oracle: ([a]) => {
        const m = lengthOracle(a!);
        return a!.map((x) => x / m);
      },
    },
  ]),
  {
    name: 'vec3Cross',
    sizes: [3, 3],
    scalars: 0,
    outSize: 3,
    oracle: ([a, b]) => F.cross(a, b) as Arr,
  },
  {
    name: 'quatMultiply',
    sizes: [4, 4],
    scalars: 0,
    outSize: 4,
    oracle: ([a, b]) => F.quaternionMultiply(a!, b!),
  },
  {
    name: 'quatConjugate',
    sizes: [4],
    scalars: 0,
    outSize: 4,
    oracle: ([a]) => F.quaternionConjugate(a!),
  },
  {
    name: 'quatNormalize',
    sizes: [4],
    scalars: 0,
    outSize: 4,
    oracle: ([a]) => F.quaternionNormalize(a!),
  },
  {
    name: 'quatRotate',
    sizes: [4, 3],
    scalars: 0,
    outSize: 3,
    oracle: ([q, v]) => F.quaternionRotate(q!, v!),
  },
  {
    name: 'quatIntegrate',
    sizes: [4, 3],
    scalars: 1,
    outSize: 4,
    oracle: ([q, w], [dt]) => {
      const h = dt! / 2;
      const spin = F.quaternionExp([0, w![0]! * h, w![1]! * h, w![2]! * h]);
      return F.quaternionNormalize(F.quaternionMultiply(spin, q!));
    },
  },
  {
    name: 'mat3Multiply',
    sizes: [9, 9],
    scalars: 0,
    outSize: 9,
    oracle: ([a, b]) => flat(F.multiply(rows(a!), rows(b!)) as Arr[]),
  },
  {
    name: 'mat3MulVec',
    sizes: [9, 3],
    scalars: 0,
    outSize: 3,
    oracle: ([m, v]) =>
      (
        F.multiply(
          rows(m!),
          v!.map((x) => [x])
        ) as Arr[]
      ).map((row) => row[0]!),
  },
  {
    name: 'mat3Transpose',
    sizes: [9],
    scalars: 0,
    outSize: 9,
    oracle: ([m]) => flat(rows(m!).map((_, i) => rows(m!).map((row) => row[i]!))),
  },
];

function draw(c: Case): { arrays: Arr[]; s: number[] } {
  return { arrays: c.sizes.map(vec), s: Array.from({ length: c.scalars }, () => rng() * 0.1) };
}

function call(
  c: Case,
  out: Arr | Float64Array | null,
  arrays: ArrayLike<number>[],
  s: number[],
  offsets: number[] = []
): unknown {
  const fn = K[c.name];
  if (typeof fn !== 'function') throw new Error(`${c.name} is not exported`);
  const head = c.outSize === 0 ? [] : [out];
  return fn(...head, ...arrays, ...s, ...offsets);
}

describe('fixed-size kernels equal their twin or oracle', () => {
  for (const c of cases) {
    it(`${c.name} (${N} seeded draws)`, () => {
      for (let k = 0; k < N; k++) {
        const { arrays, s } = draw(c);
        const expected = c.oracle(arrays, s);
        if (c.outSize === 0) {
          expectUlp([call(c, null, arrays, s) as number], [expected as number], c.ulp);
        } else {
          const out: Arr = new Array<number>(c.outSize).fill(0);
          const ret = call(c, out, arrays, s);
          expect(ret).toBe(out);
          expectUlp(out, expected as Arr, c.ulp);
        }
      }
    });
  }

  it('dot, mat3Multiply and mat3MulVec give +0 (not -0) for all-negative-zero products, as the twin does', () => {
    const negZero = [-0, -0, -0];
    const one = [1, 1, 1];
    expect(Object.is(K.vec3Dot!(negZero, one), 0)).toBe(true);
    expect(Object.is(K.vec2Dot!([-0, -0], [1, 1]), 0)).toBe(true);
    expect(Object.is(F.dot(negZero, one) as number, 0)).toBe(true);
    const z = [-0, -0, -0, -0, -0, -0, -0, -0, -0];
    const i9 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const out: Arr = new Array<number>(9).fill(1);
    K.mat3Multiply!(out, z, i9);
    for (const x of out) expect(Object.is(x, 0)).toBe(true);
    const out3: Arr = [1, 1, 1];
    K.mat3MulVec!(out3, z, one);
    for (const x of out3) expect(Object.is(x, 0)).toBe(true);
  });

  it('length and normalize take the Math.hypot path outside the plain square-root range', () => {
    for (const scale of [1e200, 1e-200]) {
      for (const n of [2, 3]) {
        const a = new Array<number>(n).fill(scale);
        expectUlp([K[`vec${n}Length`]!(a) as number], [lengthOracle(a)]);
        expectUlp([K[`vec${n}Length`]!(a) as number], [Math.hypot(...a)]);
        const out = new Array<number>(n).fill(0);
        K[`vec${n}Normalize`]!(out, a);
        const m = lengthOracle(a);
        expectUlp(
          out,
          a.map((x) => x / m)
        );
      }
      const q = [scale, scale, scale, scale];
      const outQ = [0, 0, 0, 0];
      K.quatNormalize!(outQ, q);
      expectUlp(outQ, F.quaternionNormalize(q));
      expect(outQ.every(Number.isFinite)).toBe(true);
    }
  });

  it('quatIntegrate with zero spin (w = 0 or dt = 0) gives the normalized input, as the twin does', () => {
    const intCase = cases.find((x) => x.name === 'quatIntegrate')!;
    for (let k = 0; k < 200; k++) {
      const q = vec(4);
      for (const [w, dt] of [
        [[0, 0, 0], 0.05],
        [vec(3), 0],
      ] as const) {
        const out = [0, 0, 0, 0];
        K.quatIntegrate!(out, q, w, dt);
        expectUlp(out, intCase.oracle([q, w as Arr], [dt]) as Arr);
        expect(out.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe('aliasing', () => {
  for (const c of cases.filter((x) => x.outSize > 0 && x.sizes.includes(x.outSize))) {
    it(`${c.name}: out === an input gives the same bits as a fresh out`, () => {
      for (let k = 0; k < 200; k++) {
        const { arrays, s } = draw(c);
        const fresh: Arr = new Array<number>(c.outSize).fill(0);
        call(c, fresh, arrays, s);
        for (let j = 0; j < c.sizes.length; j++) {
          if (c.sizes[j] !== c.outSize) continue;
          const alias = arrays[j]!.slice();
          const ins = arrays.slice();
          ins[j] = alias;
          call(c, alias, ins, s);
          expectUlp(alias, fresh);
        }
        if (c.sizes.length === 2 && c.sizes[0] === c.outSize && c.sizes[1] === c.outSize) {
          const same = arrays[0]!.slice();
          const freshSame: Arr = new Array<number>(c.outSize).fill(0);
          call(c, freshSame, [same, same], s);
          call(c, same, [same, same], s);
          expectUlp(same, freshSame);
        }
      }
    });
  }

  for (const c of cases.filter((x) => x.outSize > 0 && x.sizes[0]! >= x.outSize)) {
    it(`${c.name}: out overlapping the first input at a shifted offset gives the same bits as a fresh out`, () => {
      for (let k = 0; k < 200; k++) {
        const { arrays, s } = draw(c);
        const fresh: Arr = new Array<number>(c.outSize).fill(0);
        call(c, fresh, arrays, s);
        const buf = new Float64Array(c.sizes[0]! + 2);
        buf.set(arrays[0]!, 0);
        const zeros = c.sizes.map(() => 0);
        call(c, buf, [buf, ...arrays.slice(1)], s, [1, ...zeros]);
        expectUlp(Array.from(buf.subarray(1, 1 + c.outSize)), fresh);
      }
    });
  }
});

describe('offsets into strided Float64Array and number[]', () => {
  for (const c of cases) {
    it(`${c.name}: offsets give the same bits as offset 0`, () => {
      for (let k = 0; k < 200; k++) {
        const { arrays, s } = draw(c);
        const offs = [5, ...c.sizes.map((_, i) => 3 + 2 * i)];
        const packed = arrays.map((a, i) => {
          const buf = new Float64Array(a.length + offs[i + 1]! + 4);
          buf.set(a, offs[i + 1]!);
          return buf;
        });
        const plainPacked = packed.map((p) => Array.from(p));
        const ref = c.outSize === 0 ? null : new Array<number>(c.outSize).fill(0);
        const refVal = call(c, ref, arrays, s);
        const outOff = c.outSize === 0 ? [] : [offs[0]!];
        const argOffs = c.sizes.map((_, i) => offs[i + 1]!);
        for (const [outBuf, ins] of [
          [c.outSize === 0 ? null : new Float64Array(c.outSize + offs[0]! + 4), packed],
          [
            c.outSize === 0 ? null : new Array<number>(c.outSize + offs[0]! + 4).fill(0),
            plainPacked,
          ],
        ] as const) {
          const v = call(c, outBuf as Arr | null, ins as ArrayLike<number>[], s, [
            ...outOff,
            ...argOffs,
          ]);
          if (c.outSize === 0) expectUlp([v as number], [refVal as number]);
          else
            expectUlp(
              Array.from(outBuf as ArrayLike<number>).slice(offs[0]!, offs[0]! + c.outSize),
              ref!
            );
        }
      }
    });
  }
});

describe('mat3Inverse', () => {
  const eps = Number.EPSILON;
  it('A · inverse is I within κ·ε, and agrees with inv within the same bound', () => {
    for (let k = 0; k < N; k++) {
      const a = vec(9);
      const out: Arr = new Array<number>(9).fill(0);
      expect(K.mat3Inverse!(out, a)).toBe(out);
      const ref = F.inv(rows(a)) as Arr[];
      const norm = (m: Arr): number =>
        Math.max(
          ...[0, 1, 2].map((i) => Math.abs(m[i]!) + Math.abs(m[3 + i]!) + Math.abs(m[6 + i]!))
        );
      const kappa = norm(a) * norm(out);
      const bound = 64 * kappa * eps;
      const prod = new Array<number>(9).fill(0);
      K.mat3Multiply!(prod, a, out);
      for (let c = 0; c < 3; c++)
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(prod[c * 3 + i]! - (c === i ? 1 : 0))).toBeLessThanOrEqual(bound);
        }
      const refFlat = flat(ref);
      const scale = norm(refFlat);
      for (let i = 0; i < 9; i++)
        expect(Math.abs(out[i]! - refFlat[i]!)).toBeLessThanOrEqual(bound * scale);
    }
  });

  it('honours outOff and mOff on Float64Array and number[]', () => {
    for (let k = 0; k < 200; k++) {
      const a = vec(9);
      const fresh: Arr = new Array<number>(9).fill(0);
      K.mat3Inverse!(fresh, a);
      const src = new Float64Array(9 + 7);
      src.set(a, 3);
      for (const out of [new Float64Array(9 + 9), new Array<number>(9 + 9).fill(0)]) {
        K.mat3Inverse!(out, src, 5, 3);
        expectUlp(Array.from(out).slice(5, 14), fresh);
        K.mat3Inverse!(out, Array.from(src), 5, 3);
        expectUlp(Array.from(out).slice(5, 14), fresh);
      }
    }
  });

  it('is alias-safe', () => {
    const a = vec(9);
    const fresh: Arr = new Array<number>(9).fill(0);
    K.mat3Inverse!(fresh, a);
    const same = a.slice();
    K.mat3Inverse!(same, same);
    expectUlp(same, fresh);
  });
});

describe('degenerate inputs do not throw', () => {
  it('a zero quaternion gives NaN from quatNormalize, quatRotate and quatIntegrate', () => {
    const out4 = [1, 1, 1, 1];
    K.quatNormalize!(out4, [0, 0, 0, 0]);
    expect(out4.every(Number.isNaN)).toBe(true);
    const out3 = [1, 1, 1];
    K.quatRotate!(out3, [0, 0, 0, 0], [1, 2, 3]);
    expect(out3.every(Number.isNaN)).toBe(true);
    const o = [1, 1, 1, 1];
    K.quatIntegrate!(o, [0, 0, 0, 0], [0, 0, 1], 0.01);
    expect(o.every(Number.isNaN)).toBe(true);
  });

  it('a singular mat3 gives a non-finite inverse', () => {
    const out: Arr = new Array<number>(9).fill(0);
    K.mat3Inverse!(out, [1, 2, 3, 2, 4, 6, 7, 8, 9]);
    expect(out.some((x) => !Number.isFinite(x))).toBe(true);
  });

  it('a nearly singular mat3 with float entries gives large finite values', () => {
    const out: Arr = new Array<number>(9).fill(0);
    K.mat3Inverse!(out, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(out.every(Number.isFinite)).toBe(true);
    expect(Math.max(...out.map(Math.abs))).toBeGreaterThan(1e12);
  });

  it('a non-finite component gives NaN in some components and does not throw', () => {
    const out4 = [1, 1, 1, 1];
    K.quatNormalize!(out4, [Infinity, 1, 2, 3]);
    expect(out4.some(Number.isNaN)).toBe(true);
    const out3 = [1, 1, 1];
    K.vec3Normalize!(out3, [Infinity, 1, 1]);
    expect(out3.some(Number.isNaN)).toBe(true);
  });

  it('a zero vector gives NaN from vec3Normalize', () => {
    const out = [1, 1, 1];
    K.vec3Normalize!(out, [0, 0, 0]);
    expect(out.every(Number.isNaN)).toBe(true);
  });
});
