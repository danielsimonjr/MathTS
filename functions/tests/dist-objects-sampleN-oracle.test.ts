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

/** Pre-refactor guarded Box-Muller (oracle only — not production code). */
function oracleNormalRng(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
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
  it('normal sampleN matches oracle buffer', async () => {
    const mu = 1;
    const sigma = 2;
    const expected = oracleSampleN(8, SEED, (rng) => mu + sigma * oracleNormalRng(rng));
    const out = await normalDist(mu, sigma).sampleN(8, { seed: SEED });
    expectBufferEqual(out, expected);
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
    const expected = oracleSampleN(1, 42, (rng) => oracleNormalRng(rng));
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

  it('normalSampleRng guards u1=0 (no NaN)', () => {
    let calls = 0;
    const rng = (): number => {
      calls++;
      return calls === 1 ? 0 : 0.25;
    };
    const z = normalSampleRng(rng);
    expect(Number.isFinite(z)).toBe(true);
    expect(Number.isFinite(oracleNormalRng(rng))).toBe(true);
  });
});
