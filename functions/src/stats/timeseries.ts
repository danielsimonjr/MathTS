/**
 * Time-series inference (Phase 4 Task 3) — model-diagnostic statistics that sit
 * on top of the existing time-series basics (`../timeseries-extra.ts`) and the
 * general OLS engine (`../ml/ols.ts`).
 *
 * `pacf` extends `acf` (biased, ÷n, like `statsmodels.tsa.stattools.acf`) with
 * the partial autocorrelation via the Levinson-Durbin recursion — matches
 * `statsmodels.tsa.stattools.pacf(..., method='ldb')` (Levinson-Durbin on the
 * *biased* acf; the codebase's `acf` is already biased, so no separate
 * unbiased/'ld' path is offered here).
 *
 * `ljungBox` and `durbinWatson` are portmanteau/autocorrelation diagnostics for
 * residuals, matching `statsmodels.stats.diagnostic.acorr_ljungbox` and
 * `statsmodels.stats.stattools.durbin_watson`.
 *
 * `adfuller` is the Augmented Dickey-Fuller unit-root test (constant-only /
 * "c" regression model), built on `ols`. Its p-value uses a small built-in
 * MacKinnon (1994)-style critical-value table with linear interpolation —
 * this is an APPROXIMATION of the true MacKinnon response-surface p-value
 * (as used by statsmodels), not a reproduction of it; treat `pValue` as
 * indicative, not exact.
 */
import { acf } from '../timeseries-extra.js';
import { chiSquaredCDF } from '../distribution-functions.js';
import { ols } from '../ml/ols.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/**
 * Partial autocorrelation function up to `nlags` (inclusive), via the
 * Levinson-Durbin recursion applied to the biased autocorrelations (`acf`).
 * `pacf[0] = 1`. Matches `statsmodels.tsa.stattools.pacf(x, nlags, method='ldb')`.
 *
 * @example
 * pacf([1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2], 3) // => [1, 0, -0.8333..., 0]
 */
export function pacf(x: number[], nlags: number): number[] {
  const r = acf(x, nlags); // r[0..nlags], r[0] = 1 (biased estimator)
  const out = new Array<number>(nlags + 1);
  out[0] = 1;
  if (nlags === 0) return out;

  // Levinson-Durbin recursion. `phiPrev[j-1]` holds phi_{k-1,j} (1-indexed j).
  let phiPrev: number[] = [];
  for (let k = 1; k <= nlags; k++) {
    if (k === 1) {
      const phi11 = r[1];
      out[1] = phi11;
      phiPrev = [phi11];
      continue;
    }
    let num = r[k];
    let den = 1;
    for (let j = 1; j <= k - 1; j++) {
      num -= phiPrev[j - 1] * r[k - j];
      den -= phiPrev[j - 1] * r[j];
    }
    const phikk = den === 0 ? 0 : num / den;
    const phiCurr = new Array<number>(k);
    for (let j = 1; j <= k - 1; j++) {
      phiCurr[j - 1] = phiPrev[j - 1] - phikk * phiPrev[k - 1 - j];
    }
    phiCurr[k - 1] = phikk;
    out[k] = phikk;
    phiPrev = phiCurr;
  }
  return out;
}

/** Result of {@link ljungBox}. */
export interface LjungBoxResult {
  statistic: number;
  pValue: number;
}

/**
 * Ljung-Box portmanteau test for autocorrelation up to lag `lags`.
 * `Q = n(n+2) * Σ_{k=1}^{lags} ρ_k² / (n-k)`, `pValue = 1 - chiSquaredCDF(Q, lags)`.
 * Matches `statsmodels.stats.diagnostic.acorr_ljungbox`.
 */
export function ljungBox(x: number[], lags: number): LjungBoxResult {
  const n = x.length;
  if (lags < 1 || lags >= n)
    throw new Error(`ljungBox: lags ${lags} out of range for series length ${n}`);
  const r = acf(x, lags);
  let sum = 0;
  for (let k = 1; k <= lags; k++) sum += (r[k] * r[k]) / (n - k);
  const statistic = n * (n + 2) * sum;
  const pValue = 1 - chiSquaredCDF(statistic, lags);
  return { statistic, pValue };
}

/**
 * Durbin-Watson statistic for residual autocorrelation:
 * `Σ_{t=2}^{n}(e_t - e_{t-1})² / Σ_{t=1}^{n} e_t²`. Ranges (0, 4); ~2 indicates
 * no autocorrelation, <2 positive autocorrelation, >2 negative. Matches
 * `statsmodels.stats.stattools.durbin_watson`.
 */
export function durbinWatson(residuals: number[]): number {
  const e = arr(residuals);
  const n = e.length;
  if (n < 2) throw new Error('durbinWatson: need at least 2 residuals');
  let num = 0;
  for (let t = 1; t < n; t++) num += (e[t] - e[t - 1]) * (e[t] - e[t - 1]);
  let den = 0;
  for (let t = 0; t < n; t++) den += e[t] * e[t];
  if (den === 0) throw new Error('durbinWatson: residuals have zero variance');
  return num / den;
}

/** Result of {@link adfuller}. */
export interface AdfullerResult {
  statistic: number;
  pValue: number;
  usedLag: number;
}

// MacKinnon (1994)-style small-sample-adjusted critical values for the
// constant-only ("c") ADF regression: cv(n) = betaInf + beta1/n + beta2/n^2.
// This is a compact approximation of the full MacKinnon response-surface
// table, sufficient for an indicative p-value (see module docstring).
const MACKINNON_C = {
  1: { betaInf: -3.4336, beta1: -5.999, beta2: -29.25 },
  5: { betaInf: -2.8621, beta1: -2.738, beta2: -8.36 },
  10: { betaInf: -2.5671, beta1: -1.438, beta2: -4.48 },
} as const;

function adfCriticalValue(pct: 1 | 5 | 10, n: number): number {
  const { betaInf, beta1, beta2 } = MACKINNON_C[pct];
  return betaInf + beta1 / n + beta2 / (n * n);
}

/**
 * Approximate p-value for the ADF tau statistic (constant-only model), via
 * linear interpolation/extrapolation over the 1%/5%/10% MacKinnon-style
 * critical values. NOT the exact MacKinnon (1994) response-surface p-value —
 * documented approximation (see module docstring).
 */
function adfPValue(statistic: number, n: number): number {
  const cv1 = adfCriticalValue(1, n);
  const cv5 = adfCriticalValue(5, n);
  const cv10 = adfCriticalValue(10, n);

  const clamp = (p: number): number => Math.min(1, Math.max(0, p));

  if (statistic <= cv1) {
    // More negative than the 1% critical value: extrapolate below 1% using
    // the 1%-5% slope, floored just above 0.
    const slope = (0.05 - 0.01) / (cv5 - cv1);
    return clamp(0.01 + slope * (statistic - cv1));
  }
  if (statistic <= cv5) {
    const slope = (0.05 - 0.01) / (cv5 - cv1);
    return clamp(0.01 + slope * (statistic - cv1));
  }
  if (statistic <= cv10) {
    const slope = (0.1 - 0.05) / (cv10 - cv5);
    return clamp(0.05 + slope * (statistic - cv5));
  }
  // Above the 10% critical value: extrapolate using the 5%-10% slope,
  // capped at 1.
  const slope = (0.1 - 0.05) / (cv10 - cv5);
  return clamp(0.1 + slope * (statistic - cv10));
}

/**
 * Augmented Dickey-Fuller unit-root test (constant-only "c" model):
 * regresses `Δx_t` on `[1, x_{t-1}, Δx_{t-1}, ..., Δx_{t-maxlag}]` via OLS.
 * `statistic = coefficients[1] / stderr[1]` (the t-stat on the lagged level,
 * `coefficients[0]` being the intercept). `pValue` is an approximate
 * MacKinnon-style interpolation (see module docstring) — not exact.
 *
 * Default `maxlag = floor(12 * (n/100)^0.25)` (matches
 * `statsmodels.tsa.stattools.adfuller`'s default rule), clamped downward if
 * needed so the regression has more observations than parameters; `usedLag`
 * reports the lag count actually used.
 *
 * @example
 * adfuller(whiteNoiseSeries) // => { statistic: <very negative>, pValue: <small>, usedLag }
 */
export function adfuller(x: number[], maxlag?: number): AdfullerResult {
  const a = arr(x);
  const n = a.length;
  if (n < 4) throw new Error(`adfuller: series too short (length ${n})`);

  const d = new Array<number>(n - 1); // d[i] = x[i+1] - x[i]
  for (let i = 0; i < n - 1; i++) d[i] = a[i + 1] - a[i];

  let lag = maxlag ?? Math.floor(12 * Math.pow(n / 100, 0.25));
  lag = Math.max(0, Math.min(lag, n - 4));

  // Clamp downward until the regression is well-posed (enough observations,
  // no exact collinearity): rows = n - lag - 1, params = lag + 2 (intercept +
  // level + lag diff-terms), need rows > params with margin.
  for (; lag >= 0; lag--) {
    const rows = n - lag - 1;
    const params = lag + 2;
    if (rows <= params) continue;

    const X: number[][] = [];
    const y: number[] = [];
    for (let i = lag; i <= n - 2; i++) {
      const row: number[] = [a[i]];
      for (let j = 1; j <= lag; j++) row.push(d[i - j]);
      X.push(row);
      y.push(d[i]);
    }

    try {
      const result = ols(X, y);
      const statistic = result.coefficients[1] / result.stderr[1];
      if (!Number.isFinite(statistic)) continue; // near-singular design — retry with fewer lags
      const pValue = adfPValue(statistic, n);
      return { statistic, pValue, usedLag: lag };
    } catch {
      // Collinear design at this lag order — retry with fewer lags.
      continue;
    }
  }
  throw new Error(`adfuller: could not construct a well-posed regression for series length ${n}`);
}
