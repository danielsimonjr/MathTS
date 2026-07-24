/**
 * Two-sample t-test power analysis (Stats-breadth chunk).
 *
 * The test statistic under `H1` (equal-size two-sample t-test, pooled
 * variance) is noncentral-t distributed with `df = 2(nobs−1)` and
 * noncentrality `δ = effectSize·sqrt(nobs/2)`. Power is `P(|T| > t_crit)`
 * evaluated against that noncentral distribution — reusing the existing
 * `noncentralTCDF` (`./inference-extra2.ts`, Phase 4) and `studentTQuantile`
 * (`../distribution-functions.ts`) building blocks; no distribution math is
 * duplicated. Matches `statsmodels.stats.power.tt_ind_solve_power` (equal
 * group sizes, `ratio=1`).
 */
import { studentTQuantile } from '../distribution-functions.js';
import { noncentralTCDF } from './inference-extra2.js';

/** Alternative hypothesis direction. */
export type TTestPowerAlternative = 'two-sided' | 'larger' | 'smaller';

export interface TTestPowerOptions {
  /**
   * `'power'` (default): the second positional argument is `nobs` (per-group
   * sample size) and the function returns the power.
   *
   * `'nobs'`: the second positional argument is instead read as the *target
   * power*, and the function solves (by bisection) for the per-group `nobs`
   * (continuous, matching statsmodels' own continuous solver) needed to reach
   * it.
   */
  solveFor?: 'power' | 'nobs';
  /** Default `'two-sided'`. */
  alternative?: TTestPowerAlternative;
}

function powerAt(
  effectSize: number,
  nobs: number,
  alpha: number,
  alt: TTestPowerAlternative
): number {
  const df = 2 * (nobs - 1);
  const nc = effectSize * Math.sqrt(nobs / 2);

  if (alt === 'larger') {
    const tCrit = studentTQuantile(1 - alpha, df);
    return 1 - noncentralTCDF(tCrit, df, nc);
  }
  if (alt === 'smaller') {
    const tCrit = studentTQuantile(alpha, df);
    return noncentralTCDF(tCrit, df, nc);
  }
  const tCrit = studentTQuantile(1 - alpha / 2, df);
  return 1 - noncentralTCDF(tCrit, df, nc) + noncentralTCDF(-tCrit, df, nc);
}

/**
 * Statistical power of a two-sample t-test with equal group sizes.
 *
 * @param effectSize - Standardized effect size (Cohen's d)
 * @param nobsOrPower - Per-group sample size (`solveFor: 'power'`, the
 *   default) or the target power to solve for (`solveFor: 'nobs'`)
 * @param alpha - Significance level
 * @param opts - `solveFor` (default `'power'`), `alternative` (default `'two-sided'`)
 * @returns The power (default) or the required per-group `nobs` (`solveFor: 'nobs'`)
 *
 * @example
 * tTestPower(0.5, 64, 0.05); // ~0.80146 (statsmodels tt_ind_solve_power)
 * tTestPower(0.5, 0.8, 0.05, { solveFor: 'nobs' }); // ~63.77 (per-group nobs for 80% power)
 */
export function tTestPower(
  effectSize: number,
  nobsOrPower: number,
  alpha: number,
  opts: TTestPowerOptions = {}
): number {
  if (!(alpha > 0 && alpha < 1)) throw new Error('tTestPower: alpha must be in (0, 1)');
  const alt = opts.alternative ?? 'two-sided';

  if (opts.solveFor === 'nobs') {
    const targetPower = nobsOrPower;
    if (!(targetPower > 0 && targetPower < 1)) {
      throw new Error('tTestPower: target power must be in (0, 1) when solveFor is "nobs"');
    }
    if (effectSize === 0) throw new Error('tTestPower: cannot solve for nobs when effectSize is 0');

    let lo = 2 + 1e-9;
    let hi = 1e7;
    if (powerAt(effectSize, hi, alpha, alt) < targetPower) {
      throw new Error('tTestPower: target power unreachable even at nobs = 1e7');
    }
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2;
      if (powerAt(effectSize, mid, alpha, alt) < targetPower) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  const nobs = nobsOrPower;
  if (!(nobs > 1)) throw new Error('tTestPower: nobs must be greater than 1');
  return powerAt(effectSize, nobs, alpha, alt);
}
