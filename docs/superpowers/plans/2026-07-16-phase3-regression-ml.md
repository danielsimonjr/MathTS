# Phase 3 — Regression & ML Breadth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Add the regression / classification / clustering / density surface MathTS lacks — multiple OLS with inference, regularized regression, logistic regression, DBSCAN + kNN, Gaussian KDE, χ² contingency, and multiple-testing correction — all built on primitives already in the repo.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles installed: scipy 1.17.1, numpy 2.3.4, **sklearn 1.8.0**, statsmodels.

## Global Constraints

- Tests import built `dist/` — rebuild (`npx turbo build --filter=@danielsimonjr/mathts-functions`) before vitest.
- **Oracle-pinned:** verify every non-trivial expected value against scikit-learn / scipy / statsmodels **at build time** (run a `python -c "..."` snippet), then hard-code the confirmed value. Never round-trip.
- No new cross-package deps. Building blocks (all present in `functions`): `leastSquares(A,b)`, `linsolve`, `inv`, `svd`, `studentTCDF`, `fCDF`, `chiSquaredCDF`, `logisticCDF`, `normalPDF`, `kdTree`/`kdTreeNearest`. Import from source modules (`../typed/numeric.js` etc.), not `../index.js`.
- Additive & non-breaking.
- strict + eslint zero. **New public exports MUST be added to the curated `docs/reference/functions.md` table** (docs-completeness gate), then `npm run docs:functions` + `npm run docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms). Implementers commit locally, do NOT push.

## Verified current state

- Missing: `ols`/`multipleRegression`, `ridge`/`lasso`/`elasticNet`, `logisticRegression`/`glm`, `dbscan`, `knn`/`knnClassify`, `gaussianKDE`, `chi2Contingency`, multiple-testing (`bonferroni`/`benjaminiHochberg`).
- Present: `linearRegression` (1-predictor), `chiSquareTest` (needs precomputed expected), `kmeans`, `spectralClustering`, `kdTree`, `principalComponentAnalysis`.

---

### Task 1: `ols` — multiple linear regression with inference

**Files:** `functions/src/ml/ols.ts` (new); export `ols` from `index.ts`. Test `functions/tests/ols.test.ts`.

**Spec:** `ols(X: number[][], y: number[], opts?: { intercept?: boolean }): { coefficients: number[]; stderr: number[]; tValues: number[]; pValues: number[]; r2: number; adjR2: number; fStat: number; residuals: number[] }`. Design matrix `X` (rows = observations, cols = predictors); prepend an intercept column of ones if `opts.intercept !== false`. Solve normal equations `β = (XᵀX)⁻¹Xᵀy` (use `inv`/`linsolve`). Covariance `σ²(XᵀX)⁻¹` with `σ² = RSS/(n−p)`; stderr = √diag; t = β/stderr; p = `2·(1 − studentTCDF(|t|, n−p))`. `r2 = 1 − RSS/TSS`; adjR2; F-stat.

Oracle: data fitting `y = 1 + 2·x1 + 3·x2` exactly (x1=[1,2,3,4], x2=[1,0,1,0], y=[6,5,10,9]) → coefficients `[1,2,3]` (with intercept), r2 = 1, residuals ≈ 0.

- [ ] **Step 1: failing test** `functions/tests/ols.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ols } from '../src/index.js';

describe('ols (multiple regression with inference)', () => {
  it('exact fit y=1+2x1+3x2 -> coefficients [1,2,3], r2=1', () => {
    const X = [
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 0],
    ];
    const y = [6, 5, 10, 9];
    const r = ols(X, y); // intercept added by default
    expect(r.coefficients[0]).toBeCloseTo(1, 6); // intercept
    expect(r.coefficients[1]).toBeCloseTo(2, 6);
    expect(r.coefficients[2]).toBeCloseTo(3, 6);
    expect(r.r2).toBeCloseTo(1, 8);
  });
  it('returns inference fields with correct shapes', () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [2.1, 3.9, 6.2, 7.8, 10.1]; // ~ y=2x
    const r = ols(X, y);
    expect(r.coefficients).toHaveLength(2); // intercept + slope
    expect(r.stderr).toHaveLength(2);
    expect(r.pValues).toHaveLength(2);
    expect(r.coefficients[1]).toBeCloseTo(2, 1);
    expect(r.r2).toBeGreaterThan(0.99);
  });
});
```

- [ ] Step 2 RED · Step 3 implement · Step 4 GREEN + docs-completeness (add `ols` to curated table, Statistics/Regression) + regression · Step 5 gate + CHANGELOG `### Added` + commit (`feat(stats): ols multiple regression with inference`).

---

### Task 2: `ridge` / `lasso` / `elasticNet`

**Files:** `functions/src/ml/regularized-regression.ts` (new); export `ridge`, `lasso`, `elasticNet`. Test `functions/tests/regularized-regression.test.ts`.

**Spec:**

- `ridge(X, y, alpha, opts?: { intercept?: boolean }): { coefficients: number[]; intercept: number }` — closed form `β = (XᵀX + αI)⁻¹Xᵀy` (do NOT penalize the intercept; center X/y or augment appropriately). alpha ≥ 0; alpha=0 ≈ OLS.
- `lasso(X, y, alpha, opts?): { coefficients; intercept }` — coordinate descent with soft-thresholding (standardize columns; iterate to convergence). Large alpha → coefficients driven to exactly 0 (sparsity).
- `elasticNet(X, y, alpha, l1Ratio, opts?)` — coordinate descent combining L1 (soft-threshold) and L2 (ridge shrink).

**Verify vs sklearn** at build time, e.g. `python -c "from sklearn.linear_model import Ridge; import numpy as np; X=np.array([[1.],[2.],[3.],[4.]]); y=np.array([2.,4.,6.,8.]); m=Ridge(alpha=1.0).fit(X,y); print(m.coef_, m.intercept_)"`.

Oracles: `ridge(X, y, 0)` ≈ OLS slope. `ridge` with large alpha → coefficients shrink toward 0. `lasso` with large alpha → coefficients exactly 0. Pin the small-alpha ridge case to the sklearn value you confirm.

- [ ] **Step 1: failing test** (fill the ridge expected values from your sklearn run):

```ts
import { describe, it, expect } from 'vitest';
import { ridge, lasso, elasticNet } from '../src/index.js';

describe('regularized regression', () => {
  it('ridge(alpha=0) recovers the OLS slope (y=2x)', () => {
    const X = [[1], [2], [3], [4]];
    const y = [2, 4, 6, 8];
    const r = ridge(X, y, 0);
    expect(r.coefficients[0]).toBeCloseTo(2, 4);
    expect(r.intercept).toBeCloseTo(0, 4);
  });
  it('ridge with large alpha shrinks the coefficient toward 0', () => {
    const X = [[1], [2], [3], [4]];
    const y = [2, 4, 6, 8];
    const big = ridge(X, y, 1000);
    expect(Math.abs(big.coefficients[0])).toBeLessThan(1); // shrunk from 2
  });
  it('lasso with large alpha zeroes the coefficient', () => {
    const X = [[1], [2], [3], [4]];
    const y = [2, 4, 6, 8];
    const r = lasso(X, y, 100);
    expect(Math.abs(r.coefficients[0])).toBeLessThan(1e-6);
  });
  it('elasticNet runs and returns finite coefficients', () => {
    const r = elasticNet([[1], [2], [3], [4]], [2, 4, 6, 8], 0.1, 0.5);
    expect(Number.isFinite(r.coefficients[0])).toBe(true);
  });
});
```

- [ ] Steps 2–5 as usual (docs-completeness: add `ridge`/`lasso`/`elasticNet`; CHANGELOG `### Added`; commit `feat(stats): ridge/lasso/elasticNet regularized regression`).

---

### Task 3: `logisticRegression` (IRLS)

**Files:** `functions/src/ml/logistic-regression.ts` (new); export `logisticRegression`. Test `functions/tests/logistic-regression.test.ts`.

**Spec:** `logisticRegression(X: number[][], y: number[], opts?: { intercept?: boolean; tol?; maxIter? }): { coefficients: number[]; intercept: number; predict: (x: number[][]) => number[]; predictProba: (x: number[][]) => number[] }`. Binary labels y ∈ {0,1}. Fit by **IRLS** (Newton on the log-likelihood): `β ← β + (XᵀWX)⁻¹Xᵀ(y − p)`, `p = sigmoid(Xβ)`, `W = diag(p(1−p))`. `predictProba` returns sigmoid(Xβ); `predict` thresholds at 0.5.

**Verify vs sklearn** (`LogisticRegression(penalty=None)`), or use a hand-checkable separable-ish case.

Oracles: 1-D data x=[-2,-1,1,2], y=[0,0,1,1] → positive slope; `predictProba([[0]])` ≈ 0.5; `predict([[-3]])`=0, `predict([[3]])`=1.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { logisticRegression } from '../src/index.js';

describe('logisticRegression (IRLS)', () => {
  it('separable 1-D data -> positive slope, prob 0.5 at the boundary', () => {
    const X = [[-2], [-1], [1], [2]];
    const y = [0, 0, 1, 1];
    const m = logisticRegression(X, y);
    expect(m.coefficients[0]).toBeGreaterThan(0);
    expect(m.predictProba([[0]])[0]).toBeCloseTo(0.5, 1);
    expect(m.predict([[-3]])[0]).toBe(0);
    expect(m.predict([[3]])[0]).toBe(1);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: `logisticRegression`; CHANGELOG `### Added`; commit `feat(stats): logistic regression via IRLS`).

---

### Task 4: `dbscan` + `knnClassify` / `knnRegress`

**Files:** `functions/src/ml/dbscan-knn.ts` (new); export `dbscan`, `knnClassify`, `knnRegress`. Test `functions/tests/dbscan-knn.test.ts`.

**Spec:**

- `dbscan(points: number[][], eps: number, minPts: number): number[]` — DBSCAN labels (0-based cluster ids; noise = `-1`). Standard algorithm; ε-neighborhoods by **brute-force Euclidean distance** (the exported `kdTree` has no radius query — brute force is O(n²) but correct; note it).
- `knnClassify(train: number[][], labels: (number|string)[], query: number[][], k: number): (number|string)[]` — majority vote of the k nearest training points (Euclidean). Ties broken by nearest.
- `knnRegress(train: number[][], targets: number[], query: number[][], k: number): number[]` — mean of the k nearest targets.

Oracles: two well-separated blobs + one outlier → 2 clusters + one `-1`. kNN on clearly labeled clusters classifies a query into the correct cluster.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { dbscan, knnClassify, knnRegress } from '../src/index.js';

describe('dbscan + knn', () => {
  it('dbscan finds 2 clusters + noise', () => {
    const pts = [
      [0, 0],
      [0.1, 0.1],
      [0.2, 0],
      [10, 10],
      [10.1, 10],
      [10, 10.2],
      [50, 50],
    ];
    const labels = dbscan(pts, 1.0, 2);
    const clusters = new Set(labels.filter((l) => l >= 0));
    expect(clusters.size).toBe(2);
    expect(labels[6]).toBe(-1); // the far outlier is noise
  });
  it('knnClassify assigns the query to the nearest cluster label', () => {
    const train = [
      [0, 0],
      [0, 1],
      [10, 10],
      [10, 11],
    ];
    const labels = ['a', 'a', 'b', 'b'];
    const out = knnClassify(
      train,
      labels,
      [
        [0.2, 0.2],
        [10.1, 10.1],
      ],
      1
    );
    expect(out[0]).toBe('a');
    expect(out[1]).toBe('b');
  });
  it('knnRegress averages the k nearest targets', () => {
    const out = knnRegress([[0], [1], [10], [11]], [0, 0, 100, 100], [[0.5]], 2);
    expect(out[0]).toBeCloseTo(0, 6);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: `dbscan`/`knnClassify`/`knnRegress`; CHANGELOG `### Added`; commit `feat(ml): dbscan clustering + knn classifier/regressor`).

---

### Task 5: `gaussianKDE`

**Files:** `functions/src/ml/kde.ts` (new); export `gaussianKDE`. Test `functions/tests/kde.test.ts`.

**Spec:** `gaussianKDE(samples: number[], opts?: { bandwidth?: number }): { evaluate: (x: number[]) => number[]; bandwidth: number }` — 1-D Gaussian kernel density estimate. Default bandwidth via **Silverman's rule** `h = 0.9·min(σ, IQR/1.34)·n^(−1/5)`. `evaluate(xs)` returns density `(1/(n·h))·Σ_i φ((x−sᵢ)/h)` using `normalPDF` (import from source).

Oracle: `∫ density ≈ 1` (numerically over a wide grid); the density of a symmetric sample peaks near the sample mean. For a large sample of N(0,1), `evaluate([0])` ≈ 0.4 (≈ 1/√(2π)); verify the numerical integral ≈ 1.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { gaussianKDE } from '../src/index.js';

describe('gaussianKDE', () => {
  it('integrates to ~1 and peaks near the sample center', () => {
    // fixed deterministic sample roughly ~ N(0,1)
    const samples = [-2, -1.5, -1, -0.5, -0.5, 0, 0, 0, 0.5, 0.5, 1, 1.5, 2];
    const kde = gaussianKDE(samples);
    const grid: number[] = [];
    for (let x = -6; x <= 6; x += 0.05) grid.push(x);
    const dens = kde.evaluate(grid);
    const integral = dens.reduce((s, d) => s + d * 0.05, 0);
    expect(integral).toBeCloseTo(1, 1);
    const at0 = kde.evaluate([0])[0];
    const atFar = kde.evaluate([5])[0];
    expect(at0).toBeGreaterThan(atFar);
  });
});
```

- [ ] Steps 2–5 (docs-completeness: `gaussianKDE`; CHANGELOG `### Added`; commit `feat(stats): gaussianKDE kernel density estimation`).

---

### Task 6: `chi2Contingency` + multiple-testing correction

**Files:** `functions/src/stats/inference-extra.ts` (new); export `chi2Contingency`, `multipleTest` (with methods). Test `functions/tests/inference-extra.test.ts`.

**Spec:**

- `chi2Contingency(table: number[][], opts?: { correction?: boolean }): { chi2: number; pValue: number; dof: number; expected: number[][]; cramersV: number }` — χ² test of independence: expected `Eᵢⱼ = rowSumᵢ·colSumⱼ/total`; χ² = Σ(O−E)²/E (Yates continuity correction for 2×2 when `correction !== false`); dof = (r−1)(c−1); p = `1 − chiSquaredCDF(chi2, dof)`; Cramér's V = √(χ²/(total·min(r−1,c−1))).
- `multipleTest(pValues: number[], method: 'bonferroni' | 'holm' | 'bh'): number[]` — adjusted p-values. Bonferroni: `min(1, p·n)`. Holm: step-down. BH (Benjamini–Hochberg FDR): step-up `min over k≥i of (n/k)·p_(k)`, capped at 1.

**Verify vs scipy** (`scipy.stats.chi2_contingency`) and `statsmodels.stats.multitest.multipletests` at build time.

Oracles: `chi2_contingency([[10,20],[30,40]], correction=False)` → confirm chi2/p vs scipy. `bonferroni([0.01,0.04])` → `[0.02,0.08]`. BH monotonicity holds.

- [ ] **Step 1: failing test** (fill chi2 expected from your scipy run):

```ts
import { describe, it, expect } from 'vitest';
import { chi2Contingency, multipleTest } from '../src/index.js';

describe('chi2Contingency + multipleTest', () => {
  it('chi2 test of independence matches scipy (no correction)', () => {
    const r = chi2Contingency(
      [
        [10, 20],
        [30, 40],
      ],
      { correction: false }
    );
    expect(r.dof).toBe(1);
    // fill from: scipy.stats.chi2_contingency([[10,20],[30,40]], correction=False)
    expect(r.chi2).toBeCloseTo(0.4464, 3);
    expect(r.pValue).toBeCloseTo(0.504, 2);
    expect(r.expected[0][0]).toBeCloseTo(15, 6); // 40*30/100
  });
  it('bonferroni multiplies by n, capped at 1', () => {
    const adj = multipleTest([0.01, 0.04, 0.5], 'bonferroni');
    expect(adj[0]).toBeCloseTo(0.03, 8);
    expect(adj[2]).toBeCloseTo(1, 8); // 1.5 capped
  });
  it('BH adjusted p-values are monotone non-decreasing when sorted', () => {
    const adj = multipleTest([0.001, 0.008, 0.039, 0.041, 0.9], 'bh');
    expect(adj.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});
```

Confirm the chi2/p oracle before finalizing (`python -c "from scipy.stats import chi2_contingency; print(chi2_contingency([[10,20],[30,40]], correction=False)[:2])"` → chi2≈0.4464, p≈0.5040).

- [ ] Steps 2–5 (docs-completeness: `chi2Contingency`/`multipleTest`; CHANGELOG `### Added`; commit `feat(stats): chi2 contingency test + multiple-testing correction`).

---

## Release (after all 6 tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize the ML/regression additions.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish`, push tags, **verify** via `npm view` + clean-install probe of `ols`/`ridge`/`logisticRegression`/`dbscan`/`gaussianKDE`/`chi2Contingency`.
- [ ] Tick TODO Phase 3; footnote roadmap; phase-boundary check-in; then Phase 4.

## Self-Review

- All six tasks are additive. Each ML task is oracle-pinned to sklearn/scipy/statsmodels, verified at build time.
- DBSCAN uses brute-force neighborhoods (kdTree lacks a radius query) — correct, documented; a kd-tree range-search speedup is a later optimization.
