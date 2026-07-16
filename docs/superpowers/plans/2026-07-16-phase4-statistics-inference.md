# Phase 4 — Statistics Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Add the statistical-inference breadth MathTS lacks — distribution MLE fitting, exact small-n p-values, time-series inference, noncentral distribution CDFs, and circular statistics — all oracle-pinned vs scipy/statsmodels.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles: scipy 1.17.1, numpy 2.3.4, statsmodels.

## Global Constraints

- Tests import built `dist/` — rebuild before vitest.
- **Oracle-pinned:** verify non-trivial values against scipy/statsmodels **at build time** (`python -c "..."`), hard-code confirmed values. Never round-trip.
- No new cross-package deps. Building blocks present: `minimizeScalar`, `bfgs`, `gammaCDF`/`chiSquaredCDF`/`fCDF`/`studentTCDF`, `normalPDF`/`normalCDF`, `acf`, `besselI` (for von Mises), the `*Dist` factories (`normalDist(μ,σ)` → `{pdf,cdf,quantile,mean,variance,sample}`). Import from source modules, not `../index.js`.
- Additive & non-breaking. **Accuracy fixes (Task 2) must keep existing MW/KS tests green** (or, if an existing test asserts the OLD asymptotic p-value, STOP and report — do not silently change it).
- strict + eslint zero. **New public exports → curated `docs/reference/functions.md` table** (docs-completeness gate) + `npm run docs:functions`/`docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms). Implementers commit locally, do NOT push.

## Verified current state

- Missing: `fitDistribution`, `pacf`, `ljungBox`, `durbinWatson`, `adfuller`, `circmean`/`circstd`/`circvar`, `vonMisesPDF`, `mcnemar`, `cochranQ`, `noncentralChi2CDF`, `noncentralFCDF`, `noncentralTCDF`.
- Present: `acf`, `mannWhitneyTest` (async, asymptotic p), `kolmogorovSmirnovTest` (async), `kendallTau` (coefficient only), `noncentralChi2PDF`, `*Dist` factories.

---

### Task 1: `fitDistribution` — MLE distribution fitting

**Files:** `functions/src/stats/fit-distribution.ts` (new); export `fitDistribution`. Test `functions/tests/fit-distribution.test.ts`.

**Spec:** `fitDistribution(name: 'normal' | 'exponential' | 'lognormal' | 'poisson' | 'gamma', data: number[]): { params: Record<string, number>; logLikelihood: number }`.

- `normal`: μ = mean, σ = population std (MLE, ddof=0) → `{ mean, std }`.
- `exponential`: λ = 1/mean → `{ lambda }` (or `{ rate }`).
- `lognormal`: fit normal to `ln(data)` → `{ mu, sigma }` (data must be > 0).
- `poisson`: λ = mean → `{ lambda }`.
- `gamma`: MLE via `minimizeScalar`/`bfgs` on the shape (use the standard closed-form scale given shape: `θ = mean/k`; solve `ln(k) − ψ(k) = ln(mean) − mean_of_ln`, where the RHS is `ln(x̄) − (1/n)Σ ln xᵢ`; use `digamma` — import — and a 1-D solver). Return `{ shape, scale }`.
- `logLikelihood` = Σ ln pdf(xᵢ; fitted params).

**Verify vs scipy** (`scipy.stats.gamma.fit(data, floc=0)`, `norm.fit`, etc.) at build time for the gamma case.

Oracles: `normal` on `[2,4,4,4,5,5,7,9]` → mean=5, std=2 (this is the classic σ=2 dataset). `exponential` on data with mean 2 → λ=0.5. `poisson` on `[2,3,4,3]` → λ=3.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { fitDistribution } from '../src/index.js';

describe('fitDistribution (MLE)', () => {
  it('normal: mean=5, std=2 (classic dataset)', () => {
    const r = fitDistribution('normal', [2, 4, 4, 4, 5, 5, 7, 9]);
    expect(r.params.mean).toBeCloseTo(5, 6);
    expect(r.params.std).toBeCloseTo(2, 6);
  });
  it('exponential: rate = 1/mean', () => {
    const r = fitDistribution('exponential', [1, 2, 3, 2]); // mean 2
    expect(r.params.lambda ?? r.params.rate).toBeCloseTo(0.5, 6);
  });
  it('poisson: lambda = mean', () => {
    const r = fitDistribution('poisson', [2, 3, 4, 3]);
    expect(r.params.lambda).toBeCloseTo(3, 6);
  });
  it('gamma: recovers shape/scale of a gamma-ish sample (vs scipy)', () => {
    // fill exact from scipy.stats.gamma.fit([...], floc=0) at build time
    const data = [1.2, 2.4, 0.8, 3.1, 1.9, 2.2, 1.5, 2.8, 1.1, 2.0];
    const r = fitDistribution('gamma', data);
    expect(r.params.shape).toBeGreaterThan(0);
    expect(r.params.scale).toBeGreaterThan(0);
    // shape*scale should approximate the sample mean
    expect(r.params.shape * r.params.scale).toBeCloseTo(1.9, 0);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: `fitDistribution`; CHANGELOG `### Added`; commit `feat(stats): fitDistribution MLE fitting`).

---

### Task 2: exact small-n p-values — Mann–Whitney, KS-2samp; add Kendall τ p-value (ACCURACY)

**Files:** modify the existing functions (locate: `grep -rn "mannWhitney\|kolmogorovSmirnov\|kendallTau" functions/src --include=*.ts | grep -iv test`). Test `functions/tests/exact-pvalues.test.ts`.

**Spec:**

- `mannWhitneyTest`: add an **exact** p-value path for small samples (enumerate/recurrence the null distribution of U). Keep the asymptotic path for large n. Preserve the existing return shape (it's async — keep that); add the exact p when `n1·n2` is small (e.g. ≤ ~400) or expose an option.
- `kolmogorovSmirnovTest` (2-sample): add the exact p-value via the Hodges recurrence for small samples; keep the existing async shape.
- `kendallTau`: return a p-value alongside the coefficient (normal approximation `z = τ / sqrt(2(2n+5)/(9n(n−1)))`, two-sided p = `2(1 − normalCDF(|z|))`) — additive to the return object (do not break existing consumers that read the coefficient; if it currently returns a bare number, return `{ tau, pValue }` and update any internal caller + existing tests carefully, or add a separate `kendallTauTest`).

**IMPORTANT:** Read each function first. If `kendallTau` returns a bare number and existing tests assert that, **prefer adding a new `kendallTauTest(x, y): { tau, pValue }`** rather than changing `kendallTau`'s return type (non-breaking). Report which approach you took.

**Verify vs scipy at build time:** `scipy.stats.mannwhitneyu([1,2,3,4],[5,6,7,8], alternative='two-sided', method='exact')` and `scipy.stats.ks_2samp(...)` and `scipy.stats.kendalltau(...)`. Construct clean test data and pin to scipy's exact values.

- [ ] **Step 1: failing test** (fill values from your scipy runs). Example structure:

```ts
import { describe, it, expect } from 'vitest';
import { mannWhitneyTest, kendallTauTest } from '../src/index.js';

describe('exact p-values', () => {
  it('Mann-Whitney exact p for [1,2,3,4] vs [5,6,7,8] matches scipy', async () => {
    const r = await mannWhitneyTest([1, 2, 3, 4], [5, 6, 7, 8]);
    // scipy.stats.mannwhitneyu([1,2,3,4],[5,6,7,8], method='exact') two-sided p = 0.028571...
    expect(r.pValue).toBeCloseTo(0.02857, 3);
  });
  it('kendallTauTest returns tau and p-value; perfect concordance tau=1', () => {
    const r = kendallTauTest([1, 2, 3, 4], [1, 2, 3, 4]);
    expect(r.tau).toBeCloseTo(1, 8);
    expect(r.pValue).toBeLessThan(0.1);
  });
});
```

Confirm the MW exact p (`python -c "from scipy.stats import mannwhitneyu; print(mannwhitneyu([1,2,3,4],[5,6,7,8],alternative='two-sided',method='exact').pvalue)"`) before finalizing.

- [ ] Steps 2–5. **Regression: run ALL existing mannWhitney/KS/kendall tests — must stay green.** (docs-completeness if you add `kendallTauTest`; CHANGELOG `### Added`/`### Fixed`; commit `feat(stats): exact small-n p-values for Mann-Whitney/KS + Kendall tau p-value`).

---

### Task 3: time-series inference — `pacf`, `ljungBox`, `durbinWatson`, `adfuller`

**Files:** `functions/src/stats/timeseries.ts` (new); export `pacf`, `ljungBox`, `durbinWatson`, `adfuller`. Test `functions/tests/timeseries.test.ts`.

**Spec:**

- `pacf(x: number[], nlags: number): number[]` — partial autocorrelation via the **Levinson–Durbin** recursion on the autocorrelations (use existing `acf` or compute r_k). Returns pacf[0..nlags] with pacf[0]=1.
- `ljungBox(x: number[], lags: number): { statistic: number; pValue: number }` — Q = `n(n+2)·Σ_{k=1}^{lags} ρ_k²/(n−k)`; p = `1 − chiSquaredCDF(Q, lags)`.
- `durbinWatson(residuals: number[]): number` — `Σ(e_t − e_{t−1})² / Σ e_t²` (≈2 ⇔ no autocorrelation).
- `adfuller(x: number[], maxlag?: number): { statistic: number; pValue: number; usedLag: number }` — Augmented Dickey–Fuller test: regress `Δx_t` on `x_{t−1}`, a constant, and `maxlag` lagged differences (OLS via `leastSquares`/`ols`); the ADF statistic = coefficient on `x_{t−1}` / its stderr; p-value via MacKinnon approximate critical-value interpolation (a small built-in table is acceptable — document it's approximate). Default maxlag = `floor(12·(n/100)^0.25)`.

**Verify vs statsmodels** (`statsmodels.tsa.stattools.pacf/acf`, `acorr_ljungbox`, `adfuller`, `durbin_watson`) at build time.

Oracles: `durbinWatson` of alternating residuals `[1,-1,1,-1,1,-1]` ≈ 4 (strong negative autocorrelation); of `[1,1,1,1]`-ish constant-trend → near 0; of white-noise-ish → near 2. `pacf` of an AR(1) series has pacf[1] ≈ the AR coefficient and pacf[k]≈0 for k≥2.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { pacf, ljungBox, durbinWatson, adfuller } from '../src/index.js';

describe('time-series inference', () => {
  it('durbinWatson ~4 for alternating residuals (neg autocorrelation)', () => {
    expect(durbinWatson([1, -1, 1, -1, 1, -1])).toBeCloseTo(4, 1);
  });
  it('durbinWatson ~2 for a low-autocorrelation series', () => {
    const dw = durbinWatson([0.5, -0.3, 0.2, -0.4, 0.6, -0.1, 0.3, -0.5]);
    expect(dw).toBeGreaterThan(1);
    expect(dw).toBeLessThan(3.5);
  });
  it('pacf[0]=1 and returns nlags+1 values', () => {
    const p = pacf([1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2], 3);
    expect(p[0]).toBeCloseTo(1, 8);
    expect(p).toHaveLength(4);
  });
  it('ljungBox returns a statistic and p-value in [0,1]', () => {
    const r = ljungBox([1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 3);
    expect(r.statistic).toBeGreaterThan(0);
    expect(r.pValue).toBeGreaterThanOrEqual(0);
    expect(r.pValue).toBeLessThanOrEqual(1);
  });
  it('adfuller returns a statistic and p-value', () => {
    const x = Array.from({ length: 50 }, (_, i) => Math.sin(i / 3) + (i % 2) * 0.1);
    const r = adfuller(x);
    expect(Number.isFinite(r.statistic)).toBe(true);
    expect(r.pValue).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: the four names; CHANGELOG `### Added`; commit `feat(stats): time-series inference pacf/ljungBox/durbinWatson/adfuller`).

---

### Task 4: noncentral CDFs + circular statistics + McNemar / Cochran-Q

**Files:** `functions/src/stats/inference-extra2.ts` (new); export `noncentralChi2CDF`, `noncentralFCDF`, `noncentralTCDF`, `circmean`, `circstd`, `circvar`, `vonMisesPDF`, `mcnemar`, `cochranQ`. Test `functions/tests/inference-extra2.test.ts`.

**Spec:**

- `noncentralChi2CDF(x, df, nc)` — via the Poisson-weighted mixture `Σ_j e^{−nc/2}(nc/2)^j/j! · chiSquaredCDF(x, df+2j)` (truncate when weights are negligible). `noncentralFCDF(x, dfn, dfd, nc)` and `noncentralTCDF(t, df, nc)` similarly (t via the standard series or a numeric integral). Use existing `chiSquaredCDF`/`fCDF`.
- `circmean(angles, opts?: { high?; low? })` — `atan2(Σsin, Σcos)` mapped to [low,high) (default [0,2π)). `circstd`/`circvar` — `R = |Σe^{iθ}|/n`; `circvar = 1 − R`; `circstd = sqrt(−2 ln R)`.
- `vonMisesPDF(theta, mu, kappa)` — `exp(κ cos(θ−μ)) / (2π I₀(κ))` using existing `besselI` (I₀).
- `mcnemar(table2x2, opts?: { correction?: boolean })` — paired binary test: `χ² = (|b−c|−correction)²/(b+c)` (b,c = off-diagonal), dof 1, p via `chiSquaredCDF`. `cochranQ(data: number[][])` — Cochran's Q for k paired binary treatments: `Q = (k−1)[k·ΣCⱼ² − (ΣCⱼ)²] / [k·ΣRᵢ − ΣRᵢ²]`, p via `chiSquaredCDF(Q, k−1)`.

**Verify vs scipy** (`scipy.stats.ncx2.cdf`, `vonmises.pdf`, `circmean/circstd/circvar`) at build time; pin exact values.

Oracles (confirm at build): `noncentralChi2CDF(10, 3, 2)` vs `scipy.stats.ncx2.cdf(10,3,2)`; `circmean([0.1, 0.2, 6.2])` (wraps near 0); `vonMisesPDF(0, 0, 2)` = `e^2/(2π I₀(2))`.

- [ ] **Step 1: failing test** (fill noncentral/vonMises values from scipy):

```ts
import { describe, it, expect } from 'vitest';
import { noncentralChi2CDF, circmean, circvar, vonMisesPDF, mcnemar } from '../src/index.js';

describe('noncentral / circular / paired-categorical', () => {
  it('noncentralChi2CDF matches scipy ncx2.cdf(10,3,2)', () => {
    // python: scipy.stats.ncx2.cdf(10,3,2)  -> fill the value
    expect(noncentralChi2CDF(10, 3, 2)).toBeCloseTo(0.8ридж, 3); // REPLACE with the scipy value
  });
  it('circmean wraps around 0', () => {
    const m = circmean([0.1, 0.2, 6.2]); // 6.2 ~ -0.083 rad
    expect(Math.min(m, 2 * Math.PI - m)).toBeLessThan(0.3); // near 0
  });
  it('vonMisesPDF(0,0,2) = e^2/(2*pi*I0(2))', () => {
    const ref = Math.exp(2) / (2 * Math.PI * 2.2795853023360673); // I0(2)=2.27958...
    expect(vonMisesPDF(0, 0, 2)).toBeCloseTo(ref, 6);
  });
  it('mcnemar 2x2 paired test returns chi2 and p', () => {
    const r = mcnemar([[10, 5], [3, 12]], { correction: false }); // b=5,c=3 -> chi2=(2)^2/8=0.5
    expect(r.chi2).toBeCloseTo(0.5, 6);
    expect(r.pValue).toBeGreaterThan(0);
  });
});
```

**NOTE:** the noncentralChi2CDF expected value above is a placeholder — REPLACE it with the real `scipy.stats.ncx2.cdf(10,3,2)` value you compute at build time (and fix the corrupted literal).

- [ ] Steps 2–5 (docs-completeness: all nine names; CHANGELOG `### Added`; commit `feat(stats): noncentral CDFs + circular stats + McNemar/Cochran-Q`).

---

## Release (after all 4 tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize the inference additions.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish`, push tags (wait for npm propagation — `npm view` may lag ~30-60s), **verify** via `npm view` + clean-install probe.
- [ ] Tick TODO Phase 4; footnote roadmap; phase-boundary check-in; then Phase 5.

## Self-Review

- Task 2 modifies existing functions — must keep their tests green; prefer a NEW `kendallTauTest` over changing `kendallTau`'s return type.
- Every value oracle-pinned to scipy/statsmodels, verified at build time. Placeholder oracle values in the plan MUST be replaced with real computed values.
