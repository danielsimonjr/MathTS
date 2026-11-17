/**
 * Issue #979: rankdata, spearman, spearmanr, wilcoxon, kruskalWallis, mannWhitneyTest,
 * wassersteinDistance and unwrapPhase did not return on NaN or Infinity input.
 * Each call runs in a child process with a timeout, so a regression fails fast
 * and never blocks the vitest worker. The child imports the built `dist`
 * (the `test` task depends on `build`).
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = pathToFileURL(resolve(__dirname, '../dist/index.js')).href;
// A cold `import` of dist takes seconds when the full suite runs in parallel; a hang still ends the call.
const TIMEOUT_MS = 60000;

/** Run `expr` (an async JS expression over `S`) in a child; NaN and Infinity print as strings. */
function run(expr: string): unknown {
  const code = `import(${JSON.stringify(DIST)}).then(async (S) => {
    const v = await (${expr});
    console.log(JSON.stringify(v, (_k, x) =>
      typeof x === 'number' && !Number.isFinite(x) ? String(x) : x));
  });`;
  const r = spawnSync(process.execPath, ['-e', code], { timeout: TIMEOUT_MS, encoding: 'utf8' });
  if (r.error) throw new Error(`call did not return within ${TIMEOUT_MS} ms: ${expr}`);
  if (r.status !== 0) throw new Error(`child failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

describe('#979 non-finite input returns instead of hanging', { timeout: 90000 }, () => {
  it('rankdata propagates NaN (SciPy nan_policy=propagate)', () => {
    expect(run('S.rankdata([3, 1, NaN])')).toEqual(['NaN', 'NaN', 'NaN']);
  });
  it('rankdata ranks Infinity as an ordinary value', () => {
    expect(run('S.rankdata([Infinity, 1, Infinity, -Infinity])')).toEqual([3.5, 2, 3.5, 1]);
  });
  it('spearman returns NaN', () => {
    expect(run('S.spearman([1, NaN, 2, 3], [1, 2, 3, 4])')).toBe('NaN');
  });
  it('spearmanr returns NaN coefficient and p-value', () => {
    expect(run('S.spearmanr([1, NaN, 2, 3], [1, 2, 3, 4])')).toEqual({
      coefficient: 'NaN',
      pValue: 'NaN',
    });
  });
  it('wilcoxon returns NaN statistic and p-value', () => {
    expect(run('S.wilcoxon([1, NaN, 3, 4], [2, 3, 1, 5])')).toEqual({
      statistic: 'NaN',
      pValue: 'NaN',
      zStatistic: 'NaN',
    });
  });
  it('wilcoxon throws a TypeError on a string', () => {
    expect(
      run("(() => { try { S.wilcoxon('abc'); } catch (e) { return e.constructor.name; } })()")
    ).toBe('TypeError');
  });
  it('kruskalWallis returns NaN', () => {
    expect(run('S.kruskalWallis([1, NaN, 2], [3, 4, 5])')).toEqual({
      statistic: 'NaN',
      pValue: 'NaN',
      df: 1,
    });
  });
  it('mannWhitneyTest returns NaN', () => {
    expect(run('S.mannWhitneyTest([1, NaN, 3], [2, 3, 4])')).toEqual({
      uStatistic: 'NaN',
      pValue: 'NaN',
    });
  });
  it('friedmanTest returns NaN', () => {
    const r = run('S.friedmanTest([[1, 2, 3], [2, NaN, 4], [3, 1, 2]])') as { statistic: string };
    expect(r.statistic).toBe('NaN');
  });
  it('wassersteinDistance returns NaN', () => {
    expect(run('S.wassersteinDistance([1, NaN], [2, 3])')).toBe('NaN');
  });
  it('kendall tau variants return NaN (SciPy nan)', () => {
    expect(run('S.kendallTau([1, NaN, 2, 3], [1, 2, 3, 4])')).toBe('NaN');
    expect(run('S.kendalltau([1, NaN, 2, 3], [1, 2, 3, 4])')).toEqual({
      coefficient: 'NaN',
      pValue: 'NaN',
    });
    expect(run('S.kendallTauTest([1, NaN, 2, 3], [1, 2, 3, 4])')).toEqual({
      tau: 'NaN',
      pValue: 'NaN',
    });
  });
  it('unwrapPhase gives numpy.unwrap values on Infinity', () => {
    expect(run('S.unwrapPhase([Infinity, 1, 2, -Infinity])')).toEqual([
      'Infinity',
      'NaN',
      'NaN',
      'NaN',
    ]);
    expect(run('S.unwrapPhase([1, Infinity, 2])')).toEqual([1, 'NaN', 'NaN']);
    expect(run('S.unwrapPhase([1, NaN, 2])')).toEqual([1, 'NaN', 'NaN']);
  });
  it('unwrapPhase returns on a huge finite jump', () => {
    const r = run('S.unwrapPhase([0, 1e300])') as number[];
    expect(r).toHaveLength(2);
  });
  it('unwrapPhase still unwraps ordinary jumps', () => {
    const r = run('S.unwrapPhase([0, 4])') as number[];
    expect(r[1]).toBeCloseTo(4 - 2 * Math.PI, 12);
  });
});
