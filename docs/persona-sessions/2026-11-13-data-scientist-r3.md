# Data scientist — npm dogfood round 3, 2026-11-13

I am a data scientist who works in pandas, SciPy.stats and d3. I used only the published npm packages at the round-3 release versions (listed below). Environment: Windows 11, Node v26.13.0, Python 3.x with NumPy 2.3.4 and SciPy 1.17.1 as the oracle. Two other test agents ran on the same machine during my benchmarks (their processes were visible as `t5a.mjs` and `r2check/edge.mjs`, plus the patrol runtime). I did not change product code. I did not file, comment on or close issues. I did not commit or push.

## Goal

Find issues that no earlier round reported, in every export of my area, with edge inputs. Re-check the round-2 issues (#896 to #901) as a minimum.

Area for this round: the function exports of `statistics`, `signal`, `plot`, `workbook`, `numbers` and `arithmetic` (341 exports in total). `functions` and `core` are in the install list, but I used them only for the names that `statistics`, `signal` and `arithmetic` re-export, and for a few names that are plainly statistical or signal functions (`butter`, `chi2Contingency`, `adfuller`, `decimate`, `ecdf`, `coherence`, `curvefit`). Everything else in `functions` (1383 exports) is out of area.

## Install (step 2)

```
+-- @danielsimonjr/mathts-arithmetic@0.2.0
+-- @danielsimonjr/mathts-core@0.28.0
+-- @danielsimonjr/mathts-functions@0.86.0
+-- @danielsimonjr/mathts-matrix@0.11.0
+-- @danielsimonjr/mathts-numbers@0.2.0
+-- @danielsimonjr/mathts-plot@0.5.0
+-- @danielsimonjr/mathts-signal@0.2.0
+-- @danielsimonjr/mathts-statistics@0.5.0
`-- @danielsimonjr/mathts-workbook@0.6.0
```

Versions match the release list. Deviation: `mathts-matrix@0.11.0` was installed by mistake. It is not in the persona list, and no test imports it.

Note on the brief: the round-2 report has no "Issue index" section. I used the six issues that round 2 filed (#896 to #901) as the re-check set.

## What I tried, in order

1. Wrote the STARTED line, checked Node, Python and the oracle.
2. Installed the packages and recorded `npm ls`.
3. Read the round-2 report and the round-2 bench JSON. Read the six issues (all CLOSED on GitHub).
4. Made the export inventory (`data-scientist-surface.txt`) and the area list.
5. Created one shared data set with NumPy (`gen.py`, `data.json`, seed 20261113). Computed SciPy references for the tests, the fit, the descriptive values and the FFT (`oracle2.py`, `oracle3.py`, `oracle4.py`).
6. Re-checked #896 to #901 (`recheck.mjs`). Checked the strict typing of the consumer (`tc/`, `tsc` strict).
7. Compared MathTS with SciPy for descriptive statistics, hypothesis tests, regression, FFT, filters and distributions (`compare4.mjs`).
8. Verified each suspicious result with a second script (`verify5.mjs`, `verify6.mjs`, `complex.mjs`, `numbers.mjs`, `cmp.mjs`, `cmp2.mjs`).
9. Ran a table-driven sweep over the 313 callable exports of the six packages, with 15 argument sets each (empty, NaN, Infinity, size 1, 1e308, nested, Float64Array, wrong type, no args, null, size 1000, data with null). The first run used a synchronous loop and stalled on two calls. I stopped it and built a watchdog sweep (`sweep2.mjs`). It runs each call in a worker thread and terminates the worker after 4 s without progress. Results: `sweep2-results.jsonl` (4695 calls).
10. Checked the plot output (7 SVG files) with an XML parser (`plot.mjs`, Python `xml.etree`).
11. Built and ran a workbook with the `mtsw` CLI: `new`, `cell add` (data, code, test), `run`, `validate`, `graph`, failing test, undefined symbol, `--timeout`.
12. Benchmarks against NumPy and fft.js (`bench.mjs`, `bench.py`). Seven runs each, median reported.
13. Searched GitHub for each new finding (read-only `gh issue list --search`).

## Round-2 re-check (step 3)

| Issue | Title (short)                          | Fixed?     | Evidence                                                                                                                                                                                                                                                      |
| ----- | -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #896  | `corrcoef([a,b])` variables-as-rows    | partial    | Default still returns 30x30 for two 30-point vectors (`recheck.mjs`). README lines 37-40 now document the layout. `corrcoef([t,u], {rowvar: true})` returns 2x2, off-diagonal 0.0969660597 (SciPy 0.0969660597). The default layout still differs from NumPy. |
| #897  | Welch throws when n < 256              | yes        | `welchPSD` on 100 samples returns 51 bins, no throw. SciPy also returns 51 bins.                                                                                                                                                                              |
| #898  | `median()` typed `unknown`             | yes        | Strict `tsc` (`tc/consumer.ts`, `tc/types.ts`) accepts `const a: number = median([...])`.                                                                                                                                                                     |
| #899  | `sample(n)` ignores n                  | yes        | `normalDist(0,1).sample(5)` returns a Float64Array of length 5.                                                                                                                                                                                               |
| #900  | `shapiroWilkTest` Promise, README sync | yes (docs) | README (lines 69-70) now says the four tests return a Promise and must be awaited. The API still returns a Promise, as the docs say.                                                                                                                          |
| #901  | median 1e6 ~4x NumPy                   | partial    | Median 1e6 on Float64Array 31.8 ms, on Array 38.1 ms, NumPy 25.0 ms (same run, machine loaded). Round 2: 35.5 ms vs NumPy 9.0 ms on a quiet machine. The gap is smaller in this run, but the load differs. Not conclusive.                                    |

Round-2 re-check counts: yes 4, partial 2, no 0.

## New findings (round 3)

Draft issue text, with repro scripts, is in `data-scientist-issues.md`. Priority: P0 = wrong result or hang on documented use; P1 = documented feature fails or large perf gap; P2 = docs, typing, ergonomics.

### F1. P0: `rankdata`, `spearman`, `spearmanr` and `wilcoxon` never return on NaN input (hang)

`timeout 10 node -e "import('@danielsimonjr/mathts-statistics').then(m=>console.log(m.rankdata([3,1,NaN])))"` gives no output (exit 124). The watchdog also hung on `spearman`/`spearmanr` with NaN, on `wilcoxon` with NaN, nested arrays and a string (`wilcoxon('abc')`). `unwrapPhase([Infinity,1,2,-Infinity])` in `signal` also does not return.

### F2. P0: `kendalltau` p-value is wrong for random data

Data: `data.json` fields `t`, `u` (n = 30). MathTS p = 1 (tau 0.0850574713). SciPy p = 0.5239409306655621. For n = 10: MathTS 0.7838899911816578, SciPy 0.6006536596119929. The README says the default is SciPy's `auto`. Issue #777 (closed) covered a different n = 10 case. This is new evidence. Note: for the monotone-pairs check, `t = 1..10`, `u = [2,1,4,3,6,5,8,7,10,9]`, both give 0.000946.

### F3. P0: `cov` of one 1-D array returns `[]`

`cov([1,2,3,4])` returns `[]`. NumPy gives 1.6666666666666665. `variance` of the same array gives the right answer.

### F4. P0: reductions of Complex arrays return a Number built from magnitudes

`sum([1+i, 2])` = 3.414 (a Number). Expected 3+1i. `mean` = 1.7071 (expected 1.5+0.5i). `variance` = 0.1716 (expected 0.5 with ddof 0). `cumsum` and `prod` on the same input return Complex values, so the functions disagree. (`complex.mjs`.)

### F5. P1: `multinomial` time grows with the sum of the counts; it does not return for large counts

`[1e7,1e7]` returns Infinity after 1.1 s. `[1e9,1e9]` and `[1e308,1e308,1e308]` do not return within 10 s. The result is Infinity in float64, so an O(1) or log-time path is possible.

### F6. P1: `describe` gives a quantile that is not NaN where `median` is NaN (NaN policy)

`describe([1,NaN,2,3])` returns `min 1, max 3, mean NaN, q25 NaN, q50 NaN, q75 2.25`. `max([1,NaN,2,3])` returns NaN. The README says NaN propagates by default.

### F7. P1: `quantileSeq` is about 110 times slower than NumPy at 1e6

`quantileSeq(a, 0.9)` on 1e6 values: median of 7 runs 2923 ms (min 2539 ms). NumPy `np.quantile`: 26.1 ms (median of 7). MathTS `median` on the same array: 38 ms. Quantile should not be 90 times slower than median.

### F8. P2: `welchPSD` has no detrend option; DC bin differs from SciPy's default by 3.6 times

`welchPSD(s1024).psd[0]` = 1.4110. SciPy default (`detrend='constant'`) = 0.3937. SciPy `detrend=False` = 1.4074. The MathTS default matches `detrend=False` only within about 0.25 percent per bin. The options are `frameLength`, `overlap` and `window`. The d.ts has no `fs` option, and a call that passes `fs` gets no error (the option is ignored). The frequency values are correct.

### F9. P2: `wilcoxon` p-value is the normal approximation with continuity correction

For `t[:20]`, `u[:20]`: MathTS 0.14030923. SciPy default (exact, n <= 50, no ties) 0.14290619. SciPy `method='approx', correction=True` gives 0.14030923 (same as MathTS). The d.ts says "normal-approximation z statistic" but does not say the p-value is an approximation.

### F10. P2: most functions throw a raw V8 TypeError for missing or wrong-type arguments

113 functions across the six packages. Examples: `linregress([1,2,3])`, `kendallTau([1,2,3])`, `pearsonr(x)` give `Cannot read properties of undefined (reading 'length')` or `undefined is not iterable`. The message names no parameter. Some errors name an internal parameter (`sample2 is not iterable`, `x.map is not a function`).

### F11. P2: `runWorkbookWithTimeout` says "exceeded undefinedms"

`runWorkbookWithTimeout('a: 1', {})` gives `workbook execution exceeded undefinedms and was terminated`. With no second argument it throws `Cannot destructure property 'timeoutMs'`.

### F12. P2: Fraction input loses its type in `median`, `mean` and `max`

`median([1/3, 1/2, 2/3])` returns a Complex (0.5). `mean([1/3, 2/3])` and `max([1/3, 1/2])` return Numbers. `mean` of BigNumber returns a Number (2). Exact arithmetic does not carry through these reductions. (`numbers.mjs`.)

### F13. P2: `plot` silently drops non-finite points

`scatter([1,2,Infinity],[1,-Infinity,3])` draws 1 circle for 3 points. No warning. The SVG is valid and has no `NaN` or `Infinity` text.

### F14. P2: `max([])` and `min([])` return -Infinity and Infinity

NumPy raises on an empty input. `mean`, `median`, `variance` return NaN on empty input, and `iqr` throws. The three behaviours differ. (From the sweep.)

### Checked, not a bug

- `studentTTest(x, y)` (two samples) is Welch's test, as the README says (line 64). Its statistic and df differ from SciPy's default `ttest_ind` (pooled). The name may mislead a SciPy user. Not a defect.
- `mode` returns an array. The README says so (line 26).
- `fft` of a `number[]` returns a zero-padded power-of-two spectrum (length 1024 for n = 1000). The signal README says so. My round-3 check agrees: `fft(1000)` equals `fft` of the zero-padded 1024 input (max diff 0). Expect this from a NumPy user, but it is documented.
- `chiSquareTest`, `mannWhitneyTest`, `kolmogorovSmirnovTest` and `shapiroWilkTest` return a Promise. The README says so (lines 69-70). `chi2Contingency` (functions) returns a value at once and gives SciPy's result (chi2 0.18157, p 0.67003, Yates). The two APIs for the same test family differ. Ergonomics only.
- `butter(4, 0.2)` matches SciPy b and a to 1e-15.
- `anova`, `jarqueBera`, `kruskalWallis`, `fisherExact` match SciPy to 1e-14 (`compare4-out.json`).
- `corrcoef` default layout: documented (see #896 row above).

## Oracle comparison (step 4, `compare4-out.json`)

Matched SciPy/NumPy (relative error below 1e-10): t-test one sample (stat and p), linear regression (slope, intercept, r, p), polyFit degree 2, mean, median, variance (ddof 1), quantileSeq (linear), skewness, kurtosis (4e-11), MAD, IQR, SEM, ANOVA F and p, Jarque-Bera, normal CDF, gamma PPF, beta PDF, t CDF, Laplace PPF, Cauchy CDF, Student t quantile, FFT of length 1024 (|X[0..3]|), inverse FFT round trip (1.7e-15), `resample` length, `lowpassFilter` length, periodic Hann window, Spearman p, Pearson p, Mann-Whitney U, Wilcoxon statistic, Shapiro W and p (within 1e-14 after the Promise is awaited).

Differences: Kendall p (F2); FFT of length 1000 (documented padding, not a defect); Welch PSD (F8); Wilcoxon p (F9); Mann-Whitney p 0.0088747 vs SciPy 0.0090688 for the same data (`mannWhitneyTest` returns a Promise; check the approximation method, not investigated further).

## Coverage (step 5b)

Area: 341 exports (statistics 187, signal 36, plot 19, workbook 28, numbers 25, arithmetic 46).

| Group                                                 | Exports | Called                                                                                                                                                                                                                                | Edge inputs tried          | Finding                                     |
| ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- |
| Functions (typeof function) in area                   | 314     | 308 by the watchdog sweep; 3 classes (BigNumber, Complex, Fraction) by hand in `numbers.mjs`; 3 workbook classes (`Session`, `WorkbookExecutor`, `WorkbookTimeoutError`) not called (they need an executor; the CLI was used instead) | 15 sets per export (sweep) | F1, F3, F4, F5, F6, F10, F14; others "none" |
| Constants and typed bundles (27 non-function exports) | 27      | Not called as values. The sweep called them as functions and got "is not a function" errors. This is expected for constants.                                                                                                          | none                       | none                                        |
| Round-2 re-check (#896 to #901)                       | 6       | 6                                                                                                                                                                                                                                     | see table                  | #896 partial                                |

Coverage for functions: 311 of 314 called by a test (308 by the sweep plus 3 classes by hand); the other 3 are workbook classes covered only through the CLI. The rest of `functions` (1383 exports in total) is out of area by the rule above.

Coverage for the exports I named in step 4c: `kendalltau`, `spearman`, `linregress`, `corr`, `pearsonr` were called with normal and edge inputs. `median` with NaN in the first, middle and last place was run (`recheck.mjs`). `rankdata`, `spearman` and `wilcoxon` were run with NaN in the middle only (the watchdog sweep), and each hung. The distributions were checked with cdf/quantile round trips only for the normal and Student t. Not run: `cdf(quantile(p))` for all distributions; the browser check for `plot` (no browser run; the SVG was checked by XML parse, not by opening it in a browser).

## Bench (step 5)

Machine: Windows 11, Node 26.13.0, Python NumPy 2.3.4. Two other test agents and the patrol runtime were running at the same time (23 node.exe processes at the start of the bench). 7 runs each, median and min reported. Input: 1e6 values `sin(i)*1000 + (i%97)`; FFT input: 65536 samples.

| Case                              | MathTS (median ms) | NumPy (median ms) | fft.js (median ms) | Round 2 MathTS / NumPy |
| --------------------------------- | ------------------ | ----------------- | ------------------ | ---------------------- |
| median 1e6 (Float64Array)         | 31.8               | 25.0              |                    | 35.5 / 9.0             |
| median 1e6 (Array)                | 38.1               | 25.0              |                    |                        |
| quantileSeq q90 1e6 (Array)       | 2923               | 26.1 (quantile)   |                    | not measured           |
| mean 1e6 (Array)                  | 4.0                | 3.4               |                    |                        |
| std 1e6 (Array)                   | 13.6               | 19.5              |                    |                        |
| FFT 65536 (number[])              | 27.1               | 7.7               | 9.1                | not measured           |
| FFT 65536 (Float64Array, awaited) | 31.4               |                   |                    | not measured           |

Flag: quantileSeq is 110 times NumPy (F7), more than 1.5 times slower than round 2 median. FFT number[] is 3 times fft.js. The "Float64Array" FFT call without await returned in 0.7 ms because it returns a Promise; that number is not the FFT cost and I do not use it. Results are not comparable to round 2: the round-2 machine was quiet, this run was not, and the NumPy median here is 25 ms against 9 ms in round 2.

## What worked well

- Descriptive statistics on clean data match NumPy to machine precision (mean, median, variance, quantile, skewness, kurtosis, MAD, IQR, SEM).
- Linear regression, polynomial fit, Pearson, ANOVA, Jarque-Bera, Kruskal-Wallis and the gamma/beta/t/Laplace/Cauchy distributions match SciPy.
- FFT of length 1024 matches NumPy to 1e-16. Inverse FFT round trip is exact to 2e-15.
- The Promise for the four async tests is documented, and the NaN-policy option `skipNaN` works on the mean.
- The workbook CLI is solid: create, edit, run, validate, graph, a failing test exits 1, an undefined symbol is reported per cell, and `--timeout` refuses the flags it cannot support with a clear message.
- The plot SVG is valid XML for every case tried, with titles and tick labels. Empty input gives a "no data" label.
- Round-2 fixes #897, #898 and #899 hold on the published packages.

## Verdict

I would use the descriptive statistics, the regression, the FFT and the workbook now, with NumPy-checked results on clean data. I would not use `kendalltau` p-values, the Complex reductions, `cov` on a single vector, or any NaN-bearing input to `rankdata`, `spearman` or `wilcoxon` until F1 to F4 are fixed. The hangs (F1, F5, and the `unwrapPhase` hang) are the blocker for any service that accepts user data. The quantile speed (F7) blocks large-data use of quantiles.

## Files and processes (for the lead)

Created in `C:/Users/danie/mathts-dogfood-r3/data-scientist/` (scratch): `package.json`, `package-lock.json`, `node_modules/` (persona packages, `typescript`, `tsx`, `fft.js`), `gen.py`, `data.json`, `oracle2.py`, `oracle3.py`, `oracle4.py`, `scipy_oracle4.json`, `welch1024_scipy.json`, `welch1024_nodetrend.json`, `r2.md`, `r2-bench.json`, `probe1.mjs`, `recheck.mjs`, `recheck-out.json`, `cmp.mjs`, `cmp2.mjs`, `compare4.mjs`, `compare4-out.json`, `compare4-err.txt`, `verify5.mjs`, `verify6.mjs`, `hang1.mjs`, `hang2.mjs`, `complex.mjs`, `numbers.mjs`, `inventory.mjs`, `sweep.mjs` (first sweep, stopped by hang), `sweep-results.jsonl`, `sweep-current-call.txt`, `sweep-stdout.txt`, `sweep2.mjs`, `sweep2-results.jsonl`, `sweep2-current-call.txt`, `sweep2-stdout.txt`, `plot.mjs`, `plots/*.svg` (7 files), `wb/study.mtsw`, `tc/consumer.ts`, `tc/types.ts`, `tc/tsconfig.json`, `bench.mjs`, `bench.py`, `bench-mathts.json`, `bench-mathts.err`, `bench-numpy.json`, `oracle3.py`.

Files at `C:/Users/danie/mathts-dogfood-r3/`: `data-scientist-report.md` (this file), `data-scientist-issues.md` (drafts), `data-scientist-surface.txt` (export inventory, 1877 lines), `data-scientist-surface-raw.txt` (an earlier partial inventory, cut at 4000 characters; superseded by the surface file; I could not delete it because a shell hook blocked the removal; it is stale).

Processes: all node runs were foreground or background Bash tasks with `timeout`. Stopped by me: the first sweep (`bip7mfknf`, stopped with TaskStop), and two node `sweep.mjs` processes (PIDs 42760, 54484, 54344, 40584) that were stuck in sync hangs, plus their `timeout.exe` wrappers (PIDs 49400, 45904). The watchdog sweep (`bqe29hd7c`) finished on its own. No process of mine was still running at the end, as far as I could check: the remaining `timeout.exe` processes (PIDs 30004, 52332) and the `t5a`/`r2check` node processes belong to other agents, and I did not touch them.

## Issue index (round 3)

| Draft title                                                                        | Priority | Labels                                                                        |
| ---------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| rankdata, spearman, spearmanr, wilcoxon never return on NaN or non-number input    | P0       | dogfood, bug, persona:data-scientist                                          |
| kendalltau p-value is 1 at n=30 and differs from SciPy at n=10 on random data      | P0       | dogfood, bug, persona:data-scientist                                          |
| cov of one 1-D array returns an empty array                                        | P0       | dogfood, bug, persona:data-scientist                                          |
| sum, mean, variance, std of Complex arrays return magnitudes as a Number           | P0       | dogfood, bug, persona:data-scientist                                          |
| multinomial time grows with the count sum and hangs for large counts               | P1       | dogfood, bug, persona:data-scientist                                          |
| unwrapPhase does not return on Infinity input                                      | P1       | dogfood, bug, persona:data-scientist                                          |
| describe NaN policy: min/max skip NaN, quantiles do not                            | P1       | dogfood, bug, persona:data-scientist                                          |
| quantileSeq about 110 times slower than NumPy at 1e6                               | P1       | dogfood, perf, persona:data-scientist                                         |
| welchPSD has no detrend option; DC bin differs 3.6 times from SciPy default        | P2       | dogfood, api, persona:data-scientist                                          |
| wilcoxon p-value is the normal approximation, not documented as such               | P2       | dogfood, api, persona:data-scientist                                          |
| 113 functions throw raw TypeError on missing or wrong-type arguments               | P2       | dogfood, api, persona:data-scientist                                          |
| runWorkbookWithTimeout message says "undefinedms"                                  | P2       | dogfood, bug, persona:data-scientist                                          |
| Fraction input loses type in median, mean, max                                     | P2       | dogfood, bug, persona:data-scientist                                          |
| plot silently drops non-finite points                                              | P2       | dogfood, bug, persona:data-scientist                                          |
| max([]) and min([]) return infinities; empty-input policy differs across functions | P2       | dogfood, api, persona:data-scientist                                          |
| #896 default corrcoef layout (partial; documented)                                 | P2       | dogfood, api, persona:data-scientist (for the lead: decide whether to reopen) |
