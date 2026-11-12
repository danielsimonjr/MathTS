# Data scientist — npm dogfood round 2, 2026-11-12

I still think in pandas, SciPy.stats, and d3. Round 2 is against **published npm** only — I stood up `/tmp/mathts-ds-r2` on Node v22.23.4 (`"type": "module"`) and pinned the release from persona-common-r2 (`statistics@0.4.15`, `signal@0.1.87`, `plot@0.4.33`, `workbook@0.5.19`, `numbers@0.1.29`, `arithmetic@0.1.87`, `functions@0.85.0`, `core@0.27.0`). Oracle: SciPy 1.18.1 / NumPy 2.5.4.

## Goal

Same as round 1: descriptive stats on messy data, hypothesis tests and distributions vs SciPy, FFT/spectral workflow, plots (SVG + browser), workbook round-trip, README snippets as written.

## What I tried, in order

### 1. Registry sanity

`npm ls` matched the published list exactly. No version skew.

### 2. Round-1 repros (#766–#786)

I re-ran each closed dogfood issue in this persona lane on the registry tarballs (harness: `/tmp/mathts-ds-r2/harness.mjs`). Highlights:

- **#766** `studentTTest(x, 5.5)` now matches SciPy `ttest_1samp` (t=0, p=1, df=9).
- **#767** `Float64Array` works for `mean`, `median`, `mode`, `quantileSeq`, `mad`, `corr`, `describe`, etc.
- **#768** no more silent empty Welch PSD; short `n` **throws** unless `frameLength` is clamped manually (see [#897](https://github.com/danielsimonjr/MathTS/issues/897)).
- **#769** `variance(x, { ddof: 1 })` works.
- **#771** `nanmean` / `nanmedian` / `nanvariance` match NumPy on `[1,2,NaN,4,5]`.
- **#772** README documents **rate vs scale**; SciPy `gamma(a=2, scale=2).pdf(1)` via `gammaDist(2, { scale: 2 })` → 0.15163266492815836 (positional `(2,2)` is still rate).
- **#773** two-arg `resample(x, 4)` matches SciPy Fourier resample to ~1e-12.
- **#774** `signal` exports `fft`/`ifft` (async for `Float64Array` per README).
- **#775** empty `median`/`mode` return `null` without throw.
- **#776** `variance([1e308,1e308,1e308])` → `0` (NumPy overflows to `inf`).
- **#777** Kendall p matches SciPy exact on n=10.
- **#778** `quantileSeq(x, 0.25, { method: 'linear' })` works; `weibull`/`hazen` names work.
- **#779** `windowFunction('hamming', 8)` matches SciPy.
- **#780** PNG error names `rsvg-convert` / `@resvg/resvg-wasm` (no silent fail).
- **#781** `describe` includes `std`, `q25`, `q50`, `q75`.
- **#782** README shows `sampleN` for batches (but `sample(5)` still returns one draw — [#899](https://github.com/danielsimonjr/MathTS/issues/899)).
- **#783** `kolmogorovSmirnovTest(x, 'normal')` works.
- **#784** `heatmap(z, { title, colorbar: true })` renders title + colorbar strip; default heatmap still has no colorbar (by design).
- **#785** `variance` types as `number` in strict `tsc`.
- **#786** `pearsonr` on perfect line gives finite tiny p (~1e-23) vs SciPy underflow 0.

### 3. Fresh workload (R2)

**Descriptive block** on `[1..10]` — every value in `docs/persona-sessions/bench/2026-11-12-data-scientist-r2.json` matches NumPy/SciPy (mean through kurtosis).

**Signal:** `await fft` / `await ifft` on `Float64Array([1..8])` round-trips with max error ~2e-16 on `.real`. Welch on 512-point 16 Hz tone: peak f=0.03125, pmax≈42.32 vs SciPy 42.667 (~0.8%). `functions.fft(Float64Array)` now works (#706 class of bug fixed).

**Plot:** `line` / `scatter` / `histogram` return `<svg viewBox="0 0 520 320">`. Playwright Chromium loads `file://` HTML wrapping a line plot (`plot-browser.mjs`). PNG still needs rsvg on PATH.

**Workbook:** README-style `parseWorkbook` → `await createExecutor().runReport()` → `serializeWorkbook` → parse; Gauss sum 55, test pass. Data cell `[1..5]` + `mean(xs)` → 3.

**Numbers / arithmetic:** README complex add, `Fraction(1/3)`, `BigNumber.parse('1.25')`; constructor `new BigNumber(1.25)` works.

### 4. New findings (filed)

| # | Sev | Issue | Title |
|---|-----|-------|-------|
| 1 | P1 | [#896](https://github.com/danielsimonjr/MathTS/issues/896) | `corrcoef([a,b])` layout ≠ NumPy → wrong n×n matrix |
| 2 | P2 | [#897](https://github.com/danielsimonjr/MathTS/issues/897) | Welch/Bartlett throw when n&lt;256 vs SciPy clamp |
| 3 | P2 | [#898](https://github.com/danielsimonjr/MathTS/issues/898) | `median()` still `unknown` in strict consumer |
| 4 | P2 | [#899](https://github.com/danielsimonjr/MathTS/issues/899) | `sample(n)` silently ignores n |
| 5 | P2 | [#900](https://github.com/danielsimonjr/MathTS/issues/900) | `shapiroWilkTest` Promise not shown in README |
| 6 | P2 | [#901](https://github.com/danielsimonjr/MathTS/issues/901) | median 1e6 still ~4× NumPy (improved from ~16×) |

Intended labels on each issue (token cannot apply): `dogfood` + `bug|api|perf|docs|packaging` + `P0|P1|P2` + `persona:data-scientist`.

## Round-1 re-check table

| Issue | Title (short) | Fixed? |
|-------|----------------|--------|
| [#766](https://github.com/danielsimonjr/MathTS/issues/766) | `studentTTest` popmean | yes |
| [#767](https://github.com/danielsimonjr/MathTS/issues/767) | Float64Array reductions | yes |
| [#768](https://github.com/danielsimonjr/MathTS/issues/768) | Welch empty PSD | yes (throws/clamp; see #897) |
| [#769](https://github.com/danielsimonjr/MathTS/issues/769) | `variance({ddof})` | yes |
| [#771](https://github.com/danielsimonjr/MathTS/issues/771) | nan* reductions | yes |
| [#772](https://github.com/danielsimonjr/MathTS/issues/772) | gamma rate vs scale | yes (scale option + README) |
| [#773](https://github.com/danielsimonjr/MathTS/issues/773) | SciPy `resample` | yes |
| [#774](https://github.com/danielsimonjr/MathTS/issues/774) | signal `fft` export | yes |
| [#775](https://github.com/danielsimonjr/MathTS/issues/775) | empty median/mode | yes |
| [#776](https://github.com/danielsimonjr/MathTS/issues/776) | var at 1e308 | yes |
| [#777](https://github.com/danielsimonjr/MathTS/issues/777) | Kendall exact p | yes |
| [#778](https://github.com/danielsimonjr/MathTS/issues/778) | quantile `{method}` | yes |
| [#779](https://github.com/danielsimonjr/MathTS/issues/779) | window arg order | yes |
| [#780](https://github.com/danielsimonjr/MathTS/issues/780) | PNG tool hint | yes |
| [#781](https://github.com/danielsimonjr/MathTS/issues/781) | `describe` quartiles | yes |
| [#782](https://github.com/danielsimonjr/MathTS/issues/782) | `sample` vs `sampleN` docs | yes |
| [#783](https://github.com/danielsimonjr/MathTS/issues/783) | KS string cdf | yes |
| [#784](https://github.com/danielsimonjr/MathTS/issues/784) | heatmap colorbar | yes (opt-in `colorbar: true`) |
| [#785](https://github.com/danielsimonjr/MathTS/issues/785) | `variance` typed | yes |
| [#786](https://github.com/danielsimonjr/MathTS/issues/786) | pearson p=0 | yes |

## Summary

| Verdict | Detail |
|---------|--------|
| Release quality | Round 1 fixes largely landed on npm; my clean-vector stats/signal/workbook path matches SciPy. |
| Blockers left | `corrcoef` NumPy layout ([#896](https://github.com/danielsimonjr/MathTS/issues/896)) is the only P1 new hit. |
| Papercuts | Short Welch throw ([#897](https://github.com/danielsimonjr/MathTS/issues/897)), typing/docs/async sampling ([#898](https://github.com/danielsimonjr/MathTS/issues/898)–[#900](https://github.com/danielsimonjr/MathTS/issues/900)), median perf ([#901](https://github.com/danielsimonjr/MathTS/issues/901)). |

I did not patch product code this round (docs + issues only).
