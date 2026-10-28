/**
 * Seeded `.sampleN` oracle — expected buffers from an independent copy of the
 * pre-M14 guarded Box-Muller inlines (must stay bit-identical after routing
 * through `normalSampleRng`).
 */
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '@danielsimonjr/mathts-core';
import { normalDist, chiSquaredDist, logNormalDist, tDist } from '../src/typed/dist-objects.js';
import { gammaSampleRng, normalSampleRng } from '../src/probability/util/gammaSample.js';

const SEED = 0xdeadbeef;

/** Pre-refactor guarded Box-Muller N(0,1) (oracle only — not production code). */
function oracleNormalRng(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Pre-refactor scaled draw: left-associative `mu + sigma * sqrt * cos`, not
 * `mu + sigma * (sqrt * cos)`.
 */
function oracleNormalLocScale(rng: () => number, mu: number, sigma: number): number {
  const u1 = rng();
  const u2 = rng();
  return (
    mu + sigma * Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2)
  );
}

function oracleSampleN(
  count: number,
  seed: number,
  drawOne: (rng: () => number) => number
): Float64Array {
  const rng = mulberry32(seed >>> 0);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) out[i] = drawOne(rng);
  return out;
}

function expectBufferEqual(actual: Float64Array, expected: Float64Array): void {
  expect(actual.length).toBe(expected.length);
  expect(Array.from(actual)).toEqual(Array.from(expected));
}

describe('dist-objects sampleN seeded oracle (M14)', () => {
  it('normal sampleN matches left-associative oracle buffer', async () => {
    const mu = 1;
    const sigma = 2;
    const expected = oracleSampleN(8, SEED, (rng) => oracleNormalLocScale(rng, mu, sigma));
    const out = await normalDist(mu, sigma).sampleN(8, { seed: SEED });
    expectBufferEqual(out, expected);
  });

  it('normal sampleN keeps historical bits at awkward scales', async () => {
    // Recorded from main's inlined `mu + sigma * sqrt * cos` (not `sigma * z`).
    const awkward = await normalDist(-2.5, 0.1).sampleN(8, { seed: 1 });
    expect(Array.from(awkward)).toEqual([
      -2.4034025940984773, -2.3876895806247447, -2.50492278627865, -2.5180891503314453,
      -2.3693945170875814, -2.6251370287239997, -2.6634414901027785, -2.4056318850290483,
    ]);
    const huge = await normalDist(0, 1e8).sampleN(4, { seed: 99 });
    expect(Array.from(huge)).toEqual([
      55391109.7066562, -40655118.70676072, 151602589.17663214, 235974596.1278496,
    ]);
  });

  it('chi-square k=3 sampleN matches oracle buffer', async () => {
    const k = 3;
    const expected = oracleSampleN(8, SEED, (rng) => {
      let sum = 0;
      for (let i = 0; i < k; i++) {
        const z = oracleNormalRng(rng);
        sum += z * z;
      }
      return sum;
    });
    const out = await chiSquaredDist(k).sampleN(8, { seed: SEED });
    expectBufferEqual(out, expected);
  });

  it('log-normal sampleN matches oracle buffer', async () => {
    const mu = 0;
    const sigma = 1;
    const expected = oracleSampleN(8, SEED, (rng) => Math.exp(mu + sigma * oracleNormalRng(rng)));
    const out = await logNormalDist(mu, sigma).sampleN(8, { seed: SEED });
    expectBufferEqual(out, expected);
  });

  it('Student-t sampleN matches oracle buffer', async () => {
    const nu = 5;
    const expected = oracleSampleN(8, SEED, (rng) => {
      const z = oracleNormalRng(rng);
      const chi = gammaSampleRng(nu / 2, rng) * 2;
      return z / Math.sqrt(chi / nu);
    });
    const out = await tDist(nu).sampleN(8, { seed: SEED });
    expectBufferEqual(out, expected);
  });

  it('sampleN(0) returns empty Float64Array', async () => {
    const out = await normalDist().sampleN(0, { seed: SEED });
    expect(out).toBeInstanceOf(Float64Array);
    expect(out.length).toBe(0);
  });

  it('sampleN(1) matches oracle single draw', async () => {
    const expected = oracleSampleN(1, 42, (rng) => oracleNormalLocScale(rng, 0, 1));
    const out = await normalDist(0, 1).sampleN(1, { seed: 42 });
    expectBufferEqual(out, expected);
  });

  it('chi-square k=1 uses one normal draw per sample', async () => {
    const expected = oracleSampleN(4, 99, (rng) => {
      const z = oracleNormalRng(rng);
      return z * z;
    });
    const out = await chiSquaredDist(1).sampleN(4, { seed: 99 });
    expectBufferEqual(out, expected);
  });

  it('normalSampleRng matches inlined N(0,1) including u1=0 clamp', () => {
    const seqRng = (values: number[]): (() => number) => {
      let i = 0;
      return () => values[i++] ?? 0.5;
    };
    const z = normalSampleRng(seqRng([0, 0.25]));
    const oracle = oracleNormalRng(seqRng([0, 0.25]));
    expect(z).toBe(oracle);
    expect(Number.isFinite(z)).toBe(true);
    const zTiny = normalSampleRng(seqRng([1e-320, 0.3]));
    expect(zTiny).toBe(oracleNormalRng(seqRng([1e-320, 0.3])));
  });
});
