/* eslint-disable no-loss-of-precision -- mpmath dps=25 oracle literals (PR 8) */
/**
 * PR 8 — public special functions and AS dispatches pinned to mpmath / DLMF
 * constants (not to the function-under-test). Regenerate with mpmath at dps=25;
 * CI does not run Python.
 *
 * ellipticK / ellipticE: TSDoc in `functions/src/typed/special.ts` uses parameter
 * `m` (not modulus k). DLMF §19.6 reference values below use that same `m`.
 *
 * Regenerate the literals on a machine with mpmath installed (`pip install mpmath`):
 *
 *   from mpmath import (mp, mpf, loggamma, besselj, bessely, besseli, airyai, airybi, ellipk,
 *       ellipe, erfi, beta, digamma, lambertw, ci, si, li, ei, fresnelc, fresnels)
 *   mp.dps = 25
 *   loggamma(mpf('2.5'));  besselj(0, mpf('2.5'));  besselj(1, mpf('2.5'))
 *   bessely(0, mpf('2.5')); bessely(1, mpf('2.5'));  airyai(mpf('1.2')); airybi(mpf('1.2'))
 *   ellipk(mpf('0.5'));    ellipe(mpf('0.5'));      erfi(mpf('0.7'))   # ellipk/ellipe take m
 *   beta(2, 3); digamma(mpf('3.5')); besselj(2, 1); bessely(2, 1); besseli(0, 1)
 *   lambertw(1); ci(1); si(1); li(2); ei(1); fresnelc(1); fresnels(1)
 *
 * The polynomial rows (chebyshevT, hermiteH, laguerreL, legendreP) are exact small integers or
 * dyadic rationals; every other literal is the dps=25 value rounded to a double.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  lgamma,
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
  besselJ,
  besselY,
  besselI,
  ellipticK,
  ellipticE,
  erfi,
  airyAi,
  airyBi,
  beta,
  digamma,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
  lambertW,
  cosIntegral,
  sinIntegral,
  logIntegral,
  expIntegralEi,
  fresnelC,
  fresnelS,
} from '../src/index.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import {
  lgammaDispatch,
  besselJ0Dispatch,
  besselJ1Dispatch,
  besselY0Dispatch,
  besselY1Dispatch,
  ellipticKDispatch,
  ellipticEDispatch,
  airyAiDispatch,
  airyBiDispatch,
} from '../src/wasm/special/wasm-bridge.js';
import { AS_WASM_PATH } from './helpers/wasm-spy.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';

const REL = 1e-12;

function relErr(got: number, expected: number): number {
  if (!Number.isFinite(got) || !Number.isFinite(expected)) {
    return Number.isNaN(got) && Number.isNaN(expected) ? 0 : Infinity;
  }
  const scale = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  return Math.abs(got - expected) / scale;
}

function expectOracle(got: number, expected: number, label: string): void {
  expect(relErr(got, expected), label).toBeLessThan(REL);
}

/** AS pin table from CORE_SPRINT_PLAN PR 8 (mpmath dps=25). */
const AS_ORACLE: readonly {
  label: string;
  expected: number;
  js: () => number;
  wasm: () => number;
}[] = [
  {
    label: 'lgamma(2.5)',
    expected: 0.28468287047291916,
    js: () => lgamma(2.5) as number,
    wasm: () => lgammaDispatch(new Float64Array([2.5]))[0]!,
  },
  {
    label: 'besselJ0(2.5)',
    expected: -0.048383776468197996,
    js: () => besselJ0(2.5) as number,
    wasm: () => besselJ0Dispatch(new Float64Array([2.5]))[0]!,
  },
  {
    label: 'besselJ1(2.5)',
    expected: 0.49709410246427404,
    js: () => besselJ1(2.5) as number,
    wasm: () => besselJ1Dispatch(new Float64Array([2.5]))[0]!,
  },
  {
    label: 'besselY0(2.5)',
    expected: 0.49807035961523189,
    js: () => besselY0(2.5) as number,
    wasm: () => besselY0Dispatch(new Float64Array([2.5]))[0]!,
  },
  {
    label: 'besselY1(2.5)',
    expected: 0.1459181379667858,
    js: () => besselY1(2.5) as number,
    wasm: () => besselY1Dispatch(new Float64Array([2.5]))[0]!,
  },
  {
    label: 'airyAi(1.2)',
    expected: 0.10612576226331254,
    js: () => airyAi(1.2) as number,
    wasm: () => airyAiDispatch(new Float64Array([1.2]))[0]!,
  },
  {
    label: 'airyBi(1.2)',
    expected: 1.4211336756103481,
    js: () => airyBi(1.2) as number,
    wasm: () => airyBiDispatch(new Float64Array([1.2]))[0]!,
  },
  {
    label: 'ellipticK(0.5) parameter m',
    expected: 1.8540746773013719,
    js: () => ellipticK(0.5) as number,
    wasm: () => ellipticKDispatch(new Float64Array([0.5]))[0]!,
  },
  {
    label: 'ellipticE(0.5) complete E(m)',
    expected: 1.3506438810476755,
    js: () => ellipticE(0.5) as number,
    wasm: () => ellipticEDispatch(new Float64Array([0.5]))[0]!,
  },
];

describe('special public API vs mpmath / DLMF oracle (PR 8)', () => {
  for (const row of AS_ORACLE) {
    it(row.label, () => {
      expectOracle(row.js(), row.expected, row.label);
    });
  }

  it('erfi(0.7)', () => {
    expectOracle(erfi(0.7) as number, 0.94028293383350748, 'erfi(0.7)');
  });
});

describe('additional typedSpecial mpmath pins (inventory)', () => {
  it('beta(2, 3)', () => {
    expectOracle(beta(2, 3) as number, 0.08333333333333333, 'beta(2,3)');
  });

  it('digamma(3.5)', () => {
    expectOracle(digamma(3.5) as number, 1.103156640645243, 'digamma(3.5)');
  });

  it('besselJ(2, 1)', () => {
    expectOracle(besselJ(2, 1) as number, 0.11490348493190047, 'besselJ(2,1)');
  });

  it('besselY(2, 1)', () => {
    expectOracle(besselY(2, 1) as number, -1.6506826068162543, 'besselY(2,1)');
  });

  it('besselI(0, 1)', () => {
    expectOracle(besselI(0, 1) as number, 1.2660658777520084, 'besselI(0,1)');
  });

  it('chebyshevT(2, 0.5)', () => {
    expectOracle(chebyshevT(2, 0.5) as number, -0.5, 'chebyshevT(2,0.5)');
  });

  it('hermiteH(2, 1)', () => {
    expectOracle(hermiteH(2, 1) as number, 2, 'hermiteH(2,1)');
  });

  it('laguerreL(1, 3)', () => {
    expectOracle(laguerreL(1, 3) as number, -2, 'laguerreL(1,3)');
  });

  it('legendreP(2, 0.5)', () => {
    expectOracle(legendreP(2, 0.5) as number, -0.125, 'legendreP(2,0.5)');
  });

  it('lambertW(1)', () => {
    expectOracle(lambertW(1) as number, 0.5671432904097838, 'lambertW(1)');
  });

  it('cosIntegral(1)', () => {
    expectOracle(cosIntegral(1) as number, 0.33740392290096816, 'cosIntegral(1)');
  });

  it('sinIntegral(1)', () => {
    expectOracle(sinIntegral(1) as number, 0.946083070367183, 'sinIntegral(1)');
  });

  it('logIntegral(2)', () => {
    expectOracle(logIntegral(2) as number, 1.045163780117493, 'logIntegral(2)');
  });

  it('expIntegralEi(1)', () => {
    expectOracle(expIntegralEi(1) as number, 1.8951178163559368, 'expIntegralEi(1)');
  });

  it('fresnelC(1)', () => {
    expectOracle(fresnelC(1) as number, 0.7798934003768229, 'fresnelC(1)');
  });

  it('fresnelS(1)', () => {
    expectOracle(fresnelS(1) as number, 0.43825914739035476, 'fresnelS(1)');
  });
});

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;

let restoreWasmPolicy = (): void => {};
beforeAll(() => {
  restoreWasmPolicy = overrideWasmPolicy({ '*': { min: 0 } });
});
afterAll(() => {
  restoreWasmPolicy();
});

describeIfAS('special AS dispatch vs the same mpmath oracle (not JS)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    await wasmLoader.load(AS_WASM_PATH!);
  }, 30_000);

  afterAll(() => {
    wasmLoader.reset();
  });

  for (const row of AS_ORACLE) {
    it(`wasm ${row.label}`, () => {
      expectOracle(row.wasm(), row.expected, `AS ${row.label}`);
    });
  }
});
