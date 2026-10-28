/* eslint-disable no-loss-of-precision -- oracle literals are IEEE-754 doubles captured from V8 before refactor */
import { describe, it, expect } from 'vitest';
import { airyAiScalar, airyBiScalar } from '../src/wasm/special/scalars.js';

/**
 * V8-captured oracles are Object.is-equal on Node; Bun/JSC differs by at most
 * 2 ULPs on a handful of oscillatory / large-Bi points. Still rejects drift.
 */
function eq2Ulp(got: number, expected: number): boolean {
  if (Object.is(got, expected)) return true;
  if (!Number.isFinite(got) || !Number.isFinite(expected)) return false;
  const buf = new Float64Array(2);
  buf[0] = got;
  buf[1] = expected;
  const bits = new BigUint64Array(buf.buffer);
  const hi = bits[0]! > bits[1]! ? bits[0]! : bits[1]!;
  const lo = bits[0]! > bits[1]! ? bits[1]! : bits[0]!;
  return hi - lo <= 2n;
}

/** 61 samples x = -30, -29, …, 30 (step 1). */
const SAMPLE_AI: readonly number[] = [
  -0.08796818845684382, -0.2287601935393778, -0.20253010076618483, 0.016723409398810982,
  0.2331428349842725, 0.16352657883043262, -0.14983659008188568, -0.2269340533740835,
  0.11614415376051508, 0.22635849367898966, -0.17640612707798486, -0.14166127688042068,
  0.27120454080441436, -0.10526230029095275, -0.1430579316690996, 0.27821749087082875,
  -0.2659834827840773, 0.1715104393705361, -0.06655517505437289, -0.008759589255700575,
  0.040241238486428015, -0.022133721547218, -0.05270505035769245, 0.18428083526850256,
  -0.3291451739263726, 0.35076100902410745, -0.0702655329492895, -0.37881429367765806,
  0.22740742820168564, 0.5355608832923522, 0.3550280538878172, 0.13529241631288147,
  0.03492413042327436, 0.00659113935746003, 0.0009515638512063163, 0.00010834442807095002,
  0.000009947694367565041, 7.492128864292917e-7, 4.692207616113808e-8, 2.4711684308733e-9,
  1.1047532552899176e-10, 4.226275864960396e-12, 1.393184688875365e-13, 3.98177607883335e-15,
  9.920205491192447e-17, 2.1649625207379936e-18, 4.1568888289170346e-20, 7.050197298388626e-22,
  1.0600466825247967e-23, 1.4177043777933448e-25, 1.691672868670544e-27, 1.8061384424703974e-29,
  1.7299602403536957e-31, 1.4901860957672176e-33, 1.1570810853985505e-35, 8.11602682469154e-38,
  5.153011145198431e-40, 2.9672049228631594e-42, 1.5523434483416005e-44, 7.39137057788641e-47,
  3.2082175915504802e-49,
];

const SAMPLE_BI: readonly number[] = [
  -0.22444694220056566, -0.08232288371808594, 0.13833309212096356, 0.24693846912407602,
  0.08983077591664676, -0.19214681569037537, -0.20621104602689747, 0.12195196890032743,
  0.23318112230442095, -0.13498730557827635, -0.2001393093226512, 0.23012109009458953,
  0.03837248850838354, -0.2571359210023431, 0.2431231514282273, -0.06912659453101071,
  -0.11966555279762567, 0.24261322909262792, -0.29571991207807324, 0.3096547674267826,
  -0.31467982964384555, 0.3249473234552981, -0.3312515807514523, 0.29376207185271275,
  -0.14669837647074035, -0.13836913490159386, 0.3922347057070015, -0.1982896263749266,
  -0.4123025879563985, 0.10399738949694468, 0.6149266274460007, 1.2074235949528715,
  3.2980949999782143, 14.037328963730229, 83.84707140846812, 657.7920441711713, 6536.4460786997415,
  80327.79069784223, 1199586.0041146365, 21472868.89142009, 455641153.5481871, 11355782530.430319,
  329807225829.073, 11086706719059.361, 428805361786530.9, 1.8982099567493588e16,
  9.572123906049171e17, 5.475303811330581e19, 3.5389182503565646e21, 2.575535552234475e23,
  2.1037650496511e25, 1.9229446248637938e27, 1.9614581409186265e29, 2.2270054796228446e31,
  2.8077318368107116e33, 3.922030778041307e35, 6.057260305859322e37, 1.0322720225188901e40,
  1.9375655077502856e42, 3.9985169243907406e44, 9.057288512151349e46,
];

/**
 * Oracle literals captured from the pre-consolidation implementation (issue #473 / PR 8).
 * Compared with Object.is so NaN and signed-zero behavior stay pinned.
 */
describe('Airy scalar oracle (pre-refactor doubles)', () => {
  const pinAi: Array<[number, number]> = [
    [0, 0.3550280538878172],
    [1, 0.13529241631288147],
    [-1, 0.5355608832923522],
    [5, 0.00010834442807095002],
    [-5, 0.35076100902410745],
    [20, 1.691672868670544e-27],
    [-20, -0.17640612707798486],
  ];

  const pinBi: Array<[number, number]> = [
    [0, 0.6149266274460007],
    [1, 1.2074235949528715],
    [-1, 0.10399738949694468],
    [5, 657.7920441711713],
    [-5, -0.13836913490159386],
    [20, 2.1037650496511e25],
    [-20, -0.2001393093226512],
  ];

  it('Ai pinned points', () => {
    for (const [x, expected] of pinAi) {
      expect(Object.is(airyAiScalar(x), expected)).toBe(true);
    }
    expect(Object.is(airyAiScalar(NaN), NaN)).toBe(true);
    expect(Object.is(airyAiScalar(Infinity), 0)).toBe(true);
    expect(Object.is(airyAiScalar(-Infinity), NaN)).toBe(true);
  });

  it('Bi pinned points', () => {
    for (const [x, expected] of pinBi) {
      expect(Object.is(airyBiScalar(x), expected)).toBe(true);
    }
    expect(Object.is(airyBiScalar(NaN), NaN)).toBe(true);
    expect(Object.is(airyBiScalar(Infinity), NaN)).toBe(true);
    expect(Object.is(airyBiScalar(-Infinity), NaN)).toBe(true);
  });

  it('Ai samples on [-30, 30]', () => {
    for (let i = 0; i <= 60; i++) {
      const x = -30 + i;
      expect(eq2Ulp(airyAiScalar(x), SAMPLE_AI[i]!), `Ai(${x})`).toBe(true);
    }
  });

  it('Bi samples on [-30, 30]', () => {
    for (let i = 0; i <= 60; i++) {
      const x = -30 + i;
      expect(eq2Ulp(airyBiScalar(x), SAMPLE_BI[i]!), `Bi(${x})`).toBe(true);
    }
  });

  it('x = 5 stays on the power-series side (not asymptotic branch)', () => {
    // Branch uses strict x > XBIG (5.0); equality must hit the series path above.
    expect(Object.is(airyAiScalar(5), 0.00010834442807095002)).toBe(true);
    expect(Object.is(airyBiScalar(5), 657.7920441711713)).toBe(true);
  });
});
