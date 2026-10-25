import { describe, it, expect } from 'vitest';
import { mulberry32, boxMuller, createSeededRng } from '../../src/numeric/rng.js';
import { createSeededRng as barrelCreate } from '../../src/index.js';
import * as internal from '../../src/internal.js';
import { rowMajorStrides } from '../../src/numeric/strides.js';

/** Recorded at commit a6cf17af (pre-#415); recipe: `randomTensor([8], { distribution: 'normal', seed: 42 })`. */
const PRE_415_RANDOM_TENSOR_NORMAL_8_SEED_42 = [
  -0.956162229384149, 0.3220702493215296, -0.2730261048826104, -0.4946727576767142,
  -1.8416271847835968, -0.310605739735128, -1.1408820709540242, -1.1372270998855114,
];

/** First 8 outputs of makeMulberry32(42) from tensor/src/operations/random.ts (pre-move oracle). */
const MULBERRY32_42_FIRST_8 = [
  0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
  0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
];

describe('mulberry32', () => {
  it('matches the pre-move tensor oracle for seed 42', () => {
    const rng = mulberry32(42);
    const got: number[] = [];
    for (let i = 0; i < 8; i++) got.push(rng());
    expect(got).toEqual(MULBERRY32_42_FIRST_8);
  });

  it('produces independent streams for separate instances with the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const fresh = mulberry32(42);
    for (let i = 0; i < 20; i++) a();
    expect(b()).toBe(fresh());
  });

  it('coerces seed with | 0 and yields finite values in [0, 1)', () => {
    for (const seed of [0, -1]) {
      const rng = mulberry32(seed);
      const x = rng();
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('boxMuller', () => {
  it('returns finite normals for typical uniforms', () => {
    const [z0, z1] = boxMuller(0.3, 0.7);
    expect(Number.isFinite(z0)).toBe(true);
    expect(Number.isFinite(z1)).toBe(true);
  });

  it('does not return NaN when u1 is 0 (epsilon clamp)', () => {
    const [z0, z1] = boxMuller(0, 0.5);
    expect(Number.isNaN(z0)).toBe(false);
    expect(Number.isNaN(z1)).toBe(false);
  });
});

describe('createSeededRng', () => {
  it('matches MULBERRY32_42_FIRST_8 and the barrel export', () => {
    const rng = createSeededRng(42);
    const got: number[] = [];
    for (let i = 0; i < 8; i++) got.push(rng.next());
    expect(got).toEqual(MULBERRY32_42_FIRST_8);
    expect(barrelCreate).toBe(createSeededRng);
    expect('createSeededRng' in internal).toBe(false);
  });

  it('matches mulberry32 for number seeds, including | 0 coercion', () => {
    const cases: Array<{ input: number; seed: number; first: number }> = [
      { input: 42, seed: 42, first: MULBERRY32_42_FIRST_8[0] },
      { input: 42.9, seed: 42, first: MULBERRY32_42_FIRST_8[0] },
      { input: 2 ** 32 + 42, seed: 42, first: MULBERRY32_42_FIRST_8[0] },
      { input: 0, seed: 0, first: 0.26642920868471265 },
      { input: -0, seed: 0, first: 0.26642920868471265 },
      { input: NaN, seed: 0, first: 0.26642920868471265 },
      { input: Infinity, seed: 0, first: 0.26642920868471265 },
      { input: -Infinity, seed: 0, first: 0.26642920868471265 },
      { input: 2 ** 32, seed: 0, first: 0.26642920868471265 },
      { input: -1, seed: -1, first: 0.8964226141106337 },
      { input: -1.9, seed: -1, first: 0.8964226141106337 },
      { input: 2 ** 32 - 1, seed: -1, first: 0.8964226141106337 },
      { input: 1.9, seed: 1, first: 0.6270739405881613 },
      { input: 2 ** 31, seed: -2147483648, first: 0.8205775609239936 },
    ];
    for (const { input, seed, first } of cases) {
      const rng = createSeededRng(input);
      const u = mulberry32(input);
      expect(rng.seed).toBe(seed);
      expect(rng.next()).toBe(first);
      expect(u()).toBe(first);
      expect(rng.next()).toBe(u());
    }
    expect(Object.is(createSeededRng(-0).seed, 0)).toBe(true);
  });

  it('hashes strings with FNV-1a 32 over UTF-8', () => {
    expect(createSeededRng('').seed >>> 0).toBe(0x811c9dc5);
    expect(createSeededRng('').next()).toBe(0.6112444521859288);
    expect(createSeededRng('a').seed >>> 0 === 0xe40c292c).toBe(true);
    expect(createSeededRng('a').next()).toBe(0.621685681398958);
    expect(createSeededRng('42').next()).not.toBe(createSeededRng(42).next());
    expect(createSeededRng('€').seed).toBe(697271083);
    expect(createSeededRng('\uD800').seed).toBe(55024714);
    const a = createSeededRng('€');
    const b = createSeededRng('€');
    expect(a.next()).toBe(b.next());
  });

  it('rejects a seed that is neither a number nor a string', () => {
    expect(() => createSeededRng(null as unknown as number)).toThrow(
      /seed must be a number or a string/
    );
  });

  it('nextInt is floor(u * max) and rejects a bad bound', () => {
    const rng = createSeededRng(42);
    expect([
      rng.nextInt(10),
      rng.nextInt(10),
      rng.nextInt(10),
      rng.nextInt(10),
      rng.nextInt(10),
      rng.nextInt(10),
      rng.nextInt(10),
      rng.nextInt(10),
    ]).toEqual([6, 4, 8, 6, 1, 5, 2, 6]);
    const one = createSeededRng(42);
    expect(one.nextInt(1)).toBe(0);
    expect(one.next()).toBe(MULBERRY32_42_FIRST_8[1]);
    const wide = createSeededRng(42);
    expect(wide.nextInt(4294967296)).toBe(2581720956);
    const bad = createSeededRng(42);
    for (const max of [0, -1, 1.5, NaN, Infinity, 4294967297]) {
      expect(() => bad.nextInt(max)).toThrow(
        /maxExclusive must be an integer in \[1, 4294967296\]/
      );
    }
  });

  it('normal returns the Box-Muller pair and caches the spare', () => {
    const rng = createSeededRng(42);
    const normals: number[] = [];
    for (let i = 0; i < 8; i++) normals.push(rng.normal());
    expect(normals).toEqual(PRE_415_RANDOM_TENSOR_NORMAL_8_SEED_42);
    const fresh = createSeededRng(42);
    const [z0, z1] = boxMuller(MULBERRY32_42_FIRST_8[0], MULBERRY32_42_FIRST_8[1]);
    expect(fresh.normal()).toBe(z0);
    expect(fresh.next()).toBe(MULBERRY32_42_FIRST_8[2]);
    expect(fresh.normal()).toBe(z1);
  });

  it('fork is deterministic in (seed, label) and independent of order', () => {
    const parent = createSeededRng(42);
    expect(parent.fork('a').seed).toBe(1619994241);
    expect(parent.fork('a').next()).toBe(0.668102843221277);
    expect(parent.fork('b').next()).not.toBe(parent.fork('a').next());
    expect(parent.fork('island').seed).toBe(-2057141809);
    expect(parent.fork('island').next()).toBe(0.7156448678579181);
    expect(parent.fork(1).seed).toBe(-290919732);
    expect(parent.fork(1).next()).toBe(0.9641607888042927);
    expect(parent.fork('1').seed).toBe(-1869647343);
    expect(parent.fork('1').next()).toBe(0.46012711874209344);
    expect(parent.fork(1.9).seed).toBe(parent.fork(1).seed);
    expect(parent.fork(NaN).seed).toBe(parent.fork(0).seed);
    expect(parent.fork('a').fork('b').seed).toBe(-2100871778);
    expect(parent.fork('b').fork('a').seed).toBe(-618994588);
    expect(createSeededRng('a').fork('b').seed).toBe(-674113907);
    expect(createSeededRng(-1).fork('a').seed).toBe(1206314979);

    const orderA = createSeededRng(42);
    const childBfirst = orderA.fork('b');
    const childAfirst = orderA.fork('a');
    const orderB = createSeededRng(42);
    const childAsecond = orderB.fork('a');
    const childBsecond = orderB.fork('b');
    const seq = (r: ReturnType<typeof createSeededRng>) => {
      const out: number[] = [];
      for (let i = 0; i < 8; i++) out.push(r.next());
      return out;
    };
    expect(seq(childAfirst)).toEqual(seq(childAsecond));
    expect(seq(childBfirst)).toEqual(seq(childBsecond));
  });

  it('fork does not mutate the parent stream or the parent spare', () => {
    const a = createSeededRng(42);
    a.next();
    a.next();
    a.next();
    const b = createSeededRng(42);
    b.next();
    b.next();
    b.next();
    const forkOrder1 = createSeededRng(42);
    forkOrder1.next();
    forkOrder1.next();
    forkOrder1.next();
    const c1a = forkOrder1.fork('a');
    const c1i = forkOrder1.fork('island');
    const c1n = forkOrder1.fork(1);
    const forkOrder2 = createSeededRng(42);
    forkOrder2.next();
    forkOrder2.next();
    forkOrder2.next();
    const c2n = forkOrder2.fork(1);
    const c2i = forkOrder2.fork('island');
    const c2a = forkOrder2.fork('a');
    const childSeq = (r: ReturnType<typeof createSeededRng>) => {
      const out: number[] = [];
      for (let i = 0; i < 8; i++) out.push(r.next());
      return out;
    };
    expect(childSeq(c1a)).toEqual(childSeq(c2a));
    expect(childSeq(c1i)).toEqual(childSeq(c2i));
    expect(childSeq(c1n)).toEqual(childSeq(c2n));
    const afterB: number[] = [];
    for (let i = 0; i < 8; i++) afterB.push(b.next());
    const ref = mulberry32(42);
    ref();
    ref();
    ref();
    const afterRef: number[] = [];
    for (let i = 0; i < 8; i++) afterRef.push(ref());
    expect(afterB).toEqual(afterRef);

    const spareParent = createSeededRng(42);
    expect(spareParent.normal()).toBe(PRE_415_RANDOM_TENSOR_NORMAL_8_SEED_42[0]);
    spareParent.fork('a');
    expect(spareParent.normal()).toBe(0.3220702493215296);
    const childOnly = createSeededRng(1619994241);
    const childFromParent = createSeededRng(42).fork('a');
    expect(childFromParent.normal()).toBe(childOnly.normal());
  });

  it('frozen seed assignment throws and the stream stays on the original seed', () => {
    const rng = createSeededRng(42);
    expect(() => {
      (rng as { seed: number }).seed = 0;
    }).toThrow(TypeError);
    expect(rng.next()).toBe(MULBERRY32_42_FIRST_8[0]);
  });

  it('fork label must be a string or a number', () => {
    const rng = createSeededRng(42);
    expect(() => rng.fork(null as unknown as string)).toThrow(
      /fork label must be a string or a number/
    );
  });

  it('statistical sanity for a fixed seed', () => {
    const uniform = createSeededRng(42);
    let uSum = 0;
    for (let i = 0; i < 10_000; i++) {
      const u = uniform.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      uSum += u;
    }
    expect(uSum / 10_000).toBeGreaterThanOrEqual(0.45);
    expect(uSum / 10_000).toBeLessThanOrEqual(0.55);

    const normal = createSeededRng(99);
    let nSum = 0;
    let nSq = 0;
    for (let i = 0; i < 10_000; i++) {
      const z = normal.normal();
      expect(Number.isFinite(z)).toBe(true);
      nSum += z;
      nSq += z * z;
    }
    const nMean = nSum / 10_000;
    const nVar = nSq / 10_000 - nMean * nMean;
    expect(nMean).toBeGreaterThanOrEqual(-0.05);
    expect(nMean).toBeLessThanOrEqual(0.05);
    expect(nVar).toBeGreaterThanOrEqual(0.9);
    expect(nVar).toBeLessThanOrEqual(1.1);

    const dice = createSeededRng(7);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6_000; i++) {
      const face = dice.nextInt(6);
      expect(face).toBeGreaterThanOrEqual(0);
      expect(face).toBeLessThan(6);
      counts[face]++;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('rowMajorStrides', () => {
  it('handles rank 0, rank 1, and rank 3', () => {
    expect(rowMajorStrides([])).toEqual([]);
    expect(rowMajorStrides([4])).toEqual([1]);
    expect(rowMajorStrides([2, 3, 4])).toEqual([12, 4, 1]);
  });

  it('matches tensor behavior for a zero-sized axis', () => {
    expect(rowMajorStrides([0, 5])).toEqual([5, 1]);
  });
});
