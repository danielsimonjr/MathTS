/**
 * Issue #979: functions that did not return, or gave a wrong value, on NaN, Infinity or an
 * invalid index. One child process runs every case, so a regression never blocks the
 * vitest worker. In the child, each case is a thunk built in the main realm, and only the
 * call `f()` runs in `vm.runInContext` with a timeout. The timeout interrupts a loop that
 * does not end, so the case reports `timeout` and the other cases still run. The child
 * imports the built `dist` (the `test` task depends on `build`).
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const DIST = pathToFileURL(resolve(__dirname, '../dist/index.js')).href;
/** Time limit for one call in the child. */
const CASE_TIMEOUT_MS = 2000;
/** Time limit for the child process. A cold `import` of dist is slow under a full parallel run. */
const CHILD_TIMEOUT_MS = 120000;

/** Each case is a JS expression over `S` (the dist module). */
const CASES: Record<string, string> = {
  rankdataNaN: 'S.rankdata([3, 1, NaN])',
  rankdataInf: 'S.rankdata([Infinity, 1, Infinity, -Infinity])',
  spearman: 'S.spearman([1, NaN, 2, 3], [1, 2, 3, 4])',
  spearmanr: 'S.spearmanr([1, NaN, 2, 3], [1, 2, 3, 4])',
  wilcoxon: 'S.wilcoxon([1, NaN, 3, 4], [2, 3, 1, 5])',
  wilcoxonString: "S.wilcoxon('abc')",
  kruskalWallis: 'S.kruskalWallis([1, NaN, 2], [3, 4, 5])',
  mannWhitney: 'S.mannWhitneyTest([1, NaN, 3], [2, 3, 4])',
  mannWhitneyBootstrap: 'S.mannWhitneyTest([1, NaN, 3], [2, 3, 4], { bootstrap: 3 })',
  friedman: 'S.friedmanTest([[1, 2, 3], [2, NaN, 4], [3, 1, 2]])',
  wassersteinA: 'S.wassersteinDistance([1, NaN], [2, 3])',
  wassersteinB: 'S.wassersteinDistance([1, 2], [NaN, 3])',
  kendallTau: 'S.kendallTau([1, NaN, 2, 3], [1, 2, 3, 4])',
  kendalltau: 'S.kendalltau([1, NaN, 2, 3], [1, 2, 3, 4])',
  kendallTauTest: 'S.kendallTauTest([1, NaN, 2, 3], [1, 2, 3, 4])',
  unwrapInf: 'S.unwrapPhase([Infinity, 1, 2, -Infinity])',
  unwrapInfMid: 'S.unwrapPhase([1, Infinity, 2])',
  unwrapNaN: 'S.unwrapPhase([1, NaN, 2])',
  unwrapSmall: 'S.unwrapPhase([0, 4])',
  unwrapMixed: 'S.unwrapPhase([0, 5e3, -5e3, 1e4, 0])',
  unwrapHuge: 'S.unwrapPhase([0, 1e300])',
  unwrapLimit: 'S.unwrapPhase([0, 6.6e6])',
  unwrapOverflow: 'S.unwrapPhase([-1e308, 1e308])',
  ks2NaNFirst: 'S.kolmogorovSmirnov2Test([1, NaN, 2, 3], [1, 2, 3, 4])',
  ks2NaNSecond: 'S.kolmogorovSmirnov2Test([1, 2, 3, 4], [1, NaN, 2, 3])',
  ks2NaNOnly: 'S.kolmogorovSmirnov2Test([1, 2, 3], [NaN])',
  ks2Inf: 'S.kolmogorovSmirnov2Test([1, Infinity, 2, -Infinity], [1, 2, 3, 4])',
  fisherInf: 'S.fisherExact([[Infinity, 0], [0, 5]])',
  fisherNaN: 'S.fisherExact([[NaN, 1], [2, 5]])',
  fisherNegative: 'S.fisherExact([[-1, 1], [2, 5]])',
  fisherHuge: 'S.fisherExact([[1e300, 0], [0, 5]])',
  fisherUnsafe: 'S.fisherExact([[2 ** 60, 3], [4, 5]])',
  fisherWideMargin: 'S.fisherExact([[5, 2 ** 40], [3, 4]])',
  fisherValid: 'S.fisherExact([[3, 1], [2, 5]])',
  peakWidthsInf: 'S.peakWidths([1, 3, 1], [Infinity])',
  peakWidthsNegInf: 'S.peakWidths([1], [-Infinity])',
  peakWidthsHigh: 'S.peakWidths([1, 3, 1], [7])',
  peakWidthsNegative: 'S.peakWidths([1, 3, 1], [-1])',
  peakWidthsFraction: 'S.peakWidths([1, 3, 1], [1.5])',
  peakWidthsSecond: 'S.peakWidths([1, 3, 1], [1, 7])',
  peakWidthsValid: 'S.peakWidths([1, 3, 1], [1])',
  theilSenNaNx: 'S.theilSen([1, NaN, 2, 3], [1, 2, 3, 4])',
  theilSenNaNy: 'S.theilSen([1, 2, 3, 4], [1, NaN, 2, 3])',
  rankBiserialA: 'S.rankBiserial([1, NaN, 2, 3], [2, 3, 4, 5])',
  rankBiserialB: 'S.rankBiserial([2, 3, 4, 5], [1, NaN, 2, 3])',
};

/** The outcome of one case: the value, the error class and message, or a timeout. */
type Outcome = { value: unknown } | { error: string; message: string } | { timeout: true };

const CHILD = `
import vm from 'node:vm';
const S = await import(${JSON.stringify(DIST)});
const cases = ${JSON.stringify(CASES)};
const enc = (_k, x) =>
  ArrayBuffer.isView(x) ? Array.from(x)
  : typeof x === 'number' && !Number.isFinite(x) ? String(x) : x;
const out = {};
for (const [name, expr] of Object.entries(cases)) {
  const f = new Function('S', 'return ' + expr).bind(null, S);
  try {
    // Some functions (mannWhitneyTest) return a promise; their sync part runs inside the vm call.
    const v = await vm.runInContext('f()', vm.createContext({ f }), { timeout: ${CASE_TIMEOUT_MS} });
    out[name] = { value: JSON.parse(JSON.stringify(v, enc)) };
  } catch (e) {
    out[name] = e && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
      ? { timeout: true }
      : { error: e.constructor.name, message: String(e.message) };
  }
}
console.log(JSON.stringify(out, enc));
`;

let results: Record<string, Outcome> = {};

/** The value that case `name` returned; fails when the case threw or timed out. */
function value(name: string): unknown {
  const r = results[name];
  expect(r, name).toBeDefined();
  expect(r, name).toHaveProperty('value');
  return (r as { value: unknown }).value;
}

/** The error that case `name` threw; fails when the case returned or timed out. */
function error(name: string): { error: string; message: string } {
  const r = results[name];
  expect(r, name).toHaveProperty('error');
  return r as { error: string; message: string };
}

describe('#979 non-finite input returns instead of hanging', () => {
  beforeAll(() => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD], {
      timeout: CHILD_TIMEOUT_MS,
      encoding: 'utf8',
    });
    if (r.error) {
      throw new Error(
        `child did not end within ${CHILD_TIMEOUT_MS} ms, or did not start: ${r.error.message}`
      );
    }
    if (r.status !== 0) throw new Error(`child failed: ${r.stderr}`);
    results = JSON.parse(r.stdout) as Record<string, Outcome>;
  }, CHILD_TIMEOUT_MS + 10000);

  it('rankdata propagates NaN (SciPy nan_policy=propagate)', () => {
    expect(value('rankdataNaN')).toEqual(['NaN', 'NaN', 'NaN']);
  });
  it('pin: rankdata ranks Infinity as an ordinary value', () => {
    expect(value('rankdataInf')).toEqual([3.5, 2, 3.5, 1]);
  });
  it('spearman and spearmanr return NaN', () => {
    expect(value('spearman')).toBe('NaN');
    expect(value('spearmanr')).toEqual({ coefficient: 'NaN', pValue: 'NaN' });
  });
  it('wilcoxon returns NaN statistic and p-value', () => {
    expect(value('wilcoxon')).toEqual({ statistic: 'NaN', pValue: 'NaN', zStatistic: 'NaN' });
  });
  it('pin: wilcoxon throws a TypeError on a string', () => {
    expect(error('wilcoxonString').error).toBe('TypeError');
  });
  it('kruskalWallis returns NaN', () => {
    expect(value('kruskalWallis')).toEqual({ statistic: 'NaN', pValue: 'NaN', df: 1 });
  });
  it('mannWhitneyTest returns NaN, also with bootstrap', () => {
    expect(value('mannWhitney')).toEqual({ uStatistic: 'NaN', pValue: 'NaN' });
    expect(value('mannWhitneyBootstrap')).toEqual({
      uStatistic: 'NaN',
      pValueEmpirical: 'NaN',
      bootstrapStatistics: ['NaN', 'NaN', 'NaN'],
      bootstrapMean: 'NaN',
      bootstrapStd: 'NaN',
    });
  });
  it('friedmanTest returns NaN', () => {
    expect((value('friedman') as { statistic: string }).statistic).toBe('NaN');
  });
  it('wassersteinDistance returns NaN for NaN in either sample', () => {
    expect(value('wassersteinA')).toBe('NaN');
    expect(value('wassersteinB')).toBe('NaN');
  });
  it('kendall tau variants return NaN (SciPy nan)', () => {
    expect(value('kendallTau')).toBe('NaN');
    expect(value('kendalltau')).toEqual({ coefficient: 'NaN', pValue: 'NaN' });
    expect(value('kendallTauTest')).toEqual({ tau: 'NaN', pValue: 'NaN' });
  });
  it('unwrapPhase gives numpy.unwrap values on Infinity and NaN', () => {
    expect(value('unwrapInf')).toEqual(['Infinity', 'NaN', 'NaN', 'NaN']);
    expect(value('unwrapInfMid')).toEqual([1, 'NaN', 'NaN']);
  });
  it('pin: unwrapPhase propagates NaN', () => {
    expect(value('unwrapNaN')).toEqual([1, 'NaN', 'NaN']);
  });
  it('pin: unwrapPhase still unwraps ordinary jumps', () => {
    expect((value('unwrapSmall') as number[])[1]).toBeCloseTo(4 - 2 * Math.PI, 12);
  });
  it('unwrapPhase returns on large finite jumps', () => {
    // numpy 2.3.5 numpy.unwrap: the wrapped step comes from the raw difference (#1147).
    expect(value('unwrapMixed')).toEqual([
      0, -1.4155045149500438, 1.4155045149518628, 3.4521762772783404, 6.283185307180247,
    ]);
    expect(value('unwrapHuge')).toEqual([0, 0]);
    expect(value('unwrapLimit')).toEqual([0, -2.35992350243032]);
    expect(value('unwrapOverflow')).toEqual([-1e308, 'NaN']);
  });
  it('kolmogorovSmirnov2Test returns NaN for NaN in either sample', () => {
    const nan = { statistic: 'NaN', pValue: 'NaN' };
    expect(value('ks2NaNFirst')).toEqual(nan);
    expect(value('ks2NaNSecond')).toEqual(nan);
    expect(value('ks2NaNOnly')).toEqual(nan);
  });
  it('pin: kolmogorovSmirnov2Test orders Infinity as an ordinary value', () => {
    expect(value('ks2Inf')).toEqual({ statistic: 0.25, pValue: 1 });
  });
  it('fisherExact throws a RangeError unless every entry is finite and non-negative', () => {
    for (const name of ['fisherInf', 'fisherNaN', 'fisherNegative']) {
      const e = error(name);
      expect(e.error, name).toBe('RangeError');
      expect(e.message, name).toMatch(/^fisherExact:/);
    }
    // The exact value is 8 / 33 (a sum of log-gamma terms gave 0.24242424242424324).
    expect((value('fisherValid') as { pValue: number }).pValue).toBeCloseTo(8 / 33, 15);
  });
  it('fisherExact throws a RangeError for a table whose loop does not end', () => {
    expect(error('fisherHuge').message).toBe(
      'fisherExact: a marginal total of 1e+300 exceeds the supported maximum of 2^53 - 1'
    );
    expect(error('fisherUnsafe').message).toMatch(/^fisherExact: a marginal total of /);
    for (const name of ['fisherHuge', 'fisherUnsafe']) {
      expect(error(name).error, name).toBe('RangeError');
    }
  });
  it('pin: fisherExact accepts a large entry when the margins keep the loop short', () => {
    // The exact value, from integers (math.comb). A sum of log-gamma terms gave 8.823e-33:
    // log-gamma of 2^40 has an absolute error of about 3e-3.
    expect((value('fisherWideMargin') as { pValue: number }).pValue).toBe(8.847240681642632e-33);
  });
  it('peakWidths throws a RangeError for an index that is not an integer in range', () => {
    const cases: [string, number][] = [
      ['peakWidthsInf', 0],
      ['peakWidthsNegInf', 0],
      ['peakWidthsHigh', 0],
      ['peakWidthsNegative', 0],
      ['peakWidthsFraction', 0],
      ['peakWidthsSecond', 1],
    ];
    for (const [name, i] of cases) {
      const e = error(name);
      expect(e.error, name).toBe('RangeError');
      expect(e.message, name).toBe(`peakWidths: peak ${i} is not a valid index for x`);
    }
    expect(value('peakWidthsValid')).toEqual([1]);
  });
  it('theilSen returns NaN slope and intercept for NaN in x or y', () => {
    expect(value('theilSenNaNx')).toEqual({ slope: 'NaN', intercept: 'NaN' });
    expect(value('theilSenNaNy')).toEqual({ slope: 'NaN', intercept: 'NaN' });
  });
  it('rankBiserial returns NaN for NaN in either sample', () => {
    expect(value('rankBiserialA')).toBe('NaN');
    expect(value('rankBiserialB')).toBe('NaN');
  });
});
