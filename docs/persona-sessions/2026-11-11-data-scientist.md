# Data scientist — npm dogfood, 2026-11-11

I came from pandas, SciPy.stats, simple-statistics and a bit of d3. I wanted a TypeScript notebook stack: descriptive stats on messy columns, tests against a SciPy oracle, an FFT round trip, a few plots I can drop in HTML, and a workbook I can save and reload.

I did **not** build MathTS from this clone. I made `/tmp/mathts-ds-dogfood` (Node v22.23.4, `"type": "module"`) and installed published packages:

`@danielsimonjr/mathts-statistics@0.4.14`, `signal@0.1.86`, `plot@0.4.32`, `workbook@0.5.18`, `numbers@0.1.28`, `arithmetic@0.1.86` (functions `0.84.0`). Oracle: SciPy 1.18.1 / NumPy 2.5.4. Linux x86_64, Intel Xeon. Clone SHA at session start `fef4010b`. ESM only.

## Goal

Mean / median / mode / variance(ddof) / quantiles / skew / kurtosis on NaNs, empty arrays, ints, and 1e308; correlation and OLS; pdf/cdf/ppf and seeded samples; t / Shapiro / KS / ANOVA; FFT round trip, windows, filters, conv, resample, Welch vs SciPy.signal; line/scatter/hist/heatmap + SVG/PNG/HTML; workbook create → compute → serialize → parse.

## What I tried, in order

### 1. README examples (they mostly run)

statistics:

```ts
anova([
  [8.1, 8.3, 7.9],
  [9.1, 9.5, 8.9],
]);
kendallTau([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]); // 0.6
hypergeometricDist(50, 5, 10).pdf(1); // 0.43133719722856767
kolmogorovSmirnov2Test([1, 2, 3], [2, 3, 4]);
```

ANOVA F ≈ 25.6, p ≈ 0.00718 matches SciPy `f_oneway`. Hypergeometric pdf matches SciPy `hypergeom.pmf` to ~1e-16. `kendallTau` (scalar) is 0.6 as documented. `kendalltau` (object) is `{ coefficient: 0.6, pValue: 0.1416… }`.

workbook README parse → `runReport` → `serializeWorkbook` → parse again: cells `n=10`, `gaussSum=55`, test pass. Data cell `[1,2,3,4,5]` then `mean(xs)` → 3.

plot README `line([0,1,2,3],[0,1,4,9])` is a self-contained SVG (`viewBox="0 0 520 320"`). Scatter, histogram, heatmap also return `<svg>`. I wrapped a line plot in HTML; Chromium at `http://127.0.0.1:8765/out/plot.html` loaded it (only console noise: favicon 404). `file:` URLs are blocked by the automation browser.

arithmetic `mean` / `variance` on `[1..10]` match statistics (5.5 and 9.1666…). `add(new Complex(1,1), new Complex(2,3))` is `3+4i`. `new Fraction(1,3)` prints `1/3`. `new Complex(1,2)` prints `1 + 2i`.

### 2. Descriptive stats vs NumPy / SciPy

On `x = [1..10]`:

|                              | MathTS              | Oracle                         |
| ---------------------------- | ------------------- | ------------------------------ |
| mean / median                | 5.5 / 5.5           | same                           |
| variance default             | 9.1666…             | NumPy `ddof=1`                 |
| variance `'uncorrected'`     | 8.25                | NumPy `ddof=0`                 |
| std                          | 3.0276503540974917  | NumPy `ddof=1`                 |
| quantileSeq 0.25             | 3.25                | NumPy `method='linear'`        |
| skewness                     | 0                   | SciPy `bias=True`              |
| kurtosis                     | −1.2242424242424244 | SciPy `fisher=True, bias=True` |
| kurtosis `{ fisher: false }` | 1.7757…             | SciPy Pearson                  |

Ints: `mode([1,2,2,3,3,3,4])` → `[3]`; bimodal → `[1,2]`.

That is the good news. Then the pandas muscle memory started failing.

### 3. Findings

**1. P0 `studentTTest(x, 5.5)` is NaN** — [#766](https://github.com/danielsimonjr/MathTS/issues/766)

I typed the SciPy `ttest_1samp(x, popmean)` shape. MathTS one-sample is `studentTTest(x)` against **μ = 0** only. A numeric second argument is treated as a second sample, skips the length check (`5.5.length` is undefined), and returns `{ statistic: NaN, pValue: NaN, degreesOfFreedom: NaN }`. Oracle for `ttest_1samp([1..10], 5.5)` is statistic 0, p 1, df 9. `studentTTest([1,2,3,4,5])` vs 0 **does** match SciPy (t=4.242640687119285, p≈0.013236).

**2. P1 Float64Array is a lottery** — [#767](https://github.com/danielsimonjr/MathTS/issues/767)

My columns are `Float64Array`. `mean` / `variance` / `describe` / `iqr` / `skewness` accept them. `median`, `mode`, `quantileSeq`, `mad`, `corr` throw `unexpected type … Float64Array` (`quantileSeq`: expected Array or Matrix). `linregress` / `pearsonr` / `studentTTest` accept typed arrays. I cannot pass a typed array through a whole EDA without `Array.from`.

**3. P1 Welch is empty under the default frame** — [#768](https://github.com/danielsimonjr/MathTS/issues/768)

`welchPSD(64-sample sine)` → `{ psd: [], frequencies: [], frameLength: 256 }` with no error. SciPy clamps `nperseg` to `n`. With `{ frameLength: 128 }` on n=512, the peak sat at f=0.0625, pmax≈42.33 vs SciPy 42.667 (about 0.8%).

**4. P1 `{ ddof: 1 }` is a typed-function dump** — [#769](https://github.com/danielsimonjr/MathTS/issues/769)

pandas/NumPy variance is `ddof`. MathTS wants `'unbiased' | 'uncorrected' | 'biased'`. `cov(x, x, 1)` already takes ddof. Default variance matches ddof=1, so the **numbers** are fine if you never pass the option.

**5. P1 no skipna / nanmean** — [#771](https://github.com/danielsimonjr/MathTS/issues/771)

`mean([1,2,NaN,4,5])` is `NaN`. pandas skips; `numpy.nanmean` is 3. No `nanmean` export. Empty arrays: `mean`/`variance` → NaN, `median`/`mode` **throw** ([#775](https://github.com/danielsimonjr/MathTS/issues/775)).

**6. P1 gamma is rate, SciPy is scale** — [#772](https://github.com/danielsimonjr/MathTS/issues/772)

`gammaDist(2, 2).pdf(1) = 0.5413411329464507`. SciPy `gamma(a=2, scale=2).pdf(1) = 0.15163266492815833`. MathTS matches `scale=0.5` (rate=2). `.d.ts` says `rate`; the npm README does not. Beta(2,5).pdf(0.3) matches SciPy (2.1609). N(0,1) pdf/cdf/ppf match (ppf 0.975 → 1.9599639845400538 vs 1.959963984540054).

**7. P1 resample is not scipy.signal.resample** — [#773](https://github.com/danielsimonjr/MathTS/issues/773)

`resample(x, 4)` (SciPy “new length 4”) → `RangeError: Invalid array length`. Three-arg `(x, 4, 8)` linearly downsamples to `[1,3,5,7]`. SciPy FFT resample is `[2.5, 3.086, 4.5, 7.914]`. Convolution `[1,2,3]*[0,1,0.5]` matches NumPy `mode='full'`. Hamming(8) matches SciPy when called as `windowFunction(8, 'hamming')`; name-first throws ([#779](https://github.com/danielsimonjr/MathTS/issues/779)).

**8. P1 no `fft` on the signal package** — [#774](https://github.com/danielsimonjr/MathTS/issues/774)

I looked for `fft`. Signal exports `parallelFFT`. It returns `{ real, imag, originalLength }`, not `Complex[]`. Round trip on `[1..8]`: real part comes back `[1,2,3,4,5,6,7,8]` (err ~1e-16); spectrum matches NumPy `fft`. `functions.fft(Float64Array)` still throws — existing [#706](https://github.com/danielsimonjr/MathTS/issues/706) (I could not comment: GitHub 403).

**9. P2 kendall p-value is asymptotic** — [#777](https://github.com/danielsimonjr/MathTS/issues/777)

τ = 0.8222222222222222 matches SciPy. `pValue = 0.0009350263526395342` = SciPy `method='asymptotic'`. SciPy 1.18 default `auto`/`exact` on this n=10 pair is **0.0003576940035273369** (about 2.6×).

**10. P2 quantile methods** — [#778](https://github.com/danielsimonjr/MathTS/issues/778)

`quantileSeq(x, 0.25, { method: 'linear' })` throws. Third arg is `sorted?: boolean` **or** `'linear'|'lower'|'higher'|'nearest'|'midpoint'`. `'weibull'` (NumPy) is unknown. Default linear 3.25 is correct.

**11. P2 `variance([1e308,1e308,1e308])` is NaN** — [#776](https://github.com/danielsimonjr/MathTS/issues/776)

`mean` is `Infinity` (NumPy too). NumPy var overflows to `inf`. Three equal values should be 0 with Welford; two-pass Inf−Inf is NaN.

**12. P2 plot PNG** — [#780](https://github.com/danielsimonjr/MathTS/issues/780)

`@danielsimonjr/mathts-plot/render` `renderToFile(..., 'line.png')` → `PlotRenderError: No SVG converter found`. No `rsvg-convert`/`resvg` on PATH. SVG/HTML are fine. Heatmap is four viridis rects, no colorbar/ticks/title ([#784](https://github.com/danielsimonjr/MathTS/issues/784)).

**13. P2 describe / sample / KS / types / p=0**

- `describe` has no std / quartiles vs pandas ([#781](https://github.com/danielsimonjr/MathTS/issues/781)).
- README `.sample`; batch+seed is `sampleN`. `sample(5)` silently returns one float ([#782](https://github.com/danielsimonjr/MathTS/issues/782)). `seedProbabilityRng(1)` **does** repeat `random()`.
- `kolmogorovSmirnovTest(x, 'normal')` throws; pass a function ([#783](https://github.com/danielsimonjr/MathTS/issues/783)). ks2 p=0.996 vs SciPy 1.0.
- `const v: number = variance(...)` → `unknown` ([#785](https://github.com/danielsimonjr/MathTS/issues/785)). Strict `tsc` on a statistics-only project also hits GPUBuffer (#726) and workerpool `child_process` (#697).
- `pearsonr` / `linregress` on y=2x+1: slope/r match; `pValue: 0` vs SciPy 1.7e-61 / 4.4e-80 ([#786](https://github.com/danielsimonjr/MathTS/issues/786)).

**14. Duplicates I could not comment on (token 403 `addComment`)**

- [#714](https://github.com/danielsimonjr/MathTS/issues/714) `new BigNumber(1.25)` — constructable, `toString` throws; `BigNumber.parse` / `fromNumber` work. numbers README does not say that.
- [#712](https://github.com/danielsimonjr/MathTS/issues/712) median n=1e6: MathTS **~151 ms** vs NumPy **~9.55 ms** (~16×). mean 0.47 vs 0.26 ms; var 1.34 vs 1.24 ms; corr 11.1 vs 4.24 ms. See `docs/persona-sessions/bench/2026-11-11-data-scientist.json`.

### 4. What worked cleanly

- Workbook README + data-cell `mean`.
- N(0,1), t(10) quantile 2.228138851986028 vs SciPy 2.228138851986274 (~2e-13).
- Shapiro on `[1..10]`: W≈0.970164611, p≈0.892367 vs SciPy 0.970164611 / 0.892367308.
- ANOVA, hypergeometric README values.
- FFT round trip via `parallelFFT`/`parallelIFFT` once I stopped expecting a `Complex[]`.
- `convolve` full mode; Hamming window in the documented order.
- Line/scatter/hist SVG; heatmap cells; empty heatmap “no data” placeholder; NaN in a line series still draws (does not crash).
- `seedProbabilityRng` + `random()` is deterministic.

## Summary table

| #   | Sev | Issue                                                      | Title                                             |
| --- | --- | ---------------------------------------------------------- | ------------------------------------------------- |
| 1   | P0  | [#766](https://github.com/danielsimonjr/MathTS/issues/766) | studentTTest(sample, 5.5) NaNs                    |
| 2   | P1  | [#767](https://github.com/danielsimonjr/MathTS/issues/767) | median/mode/quantile/mad/corr reject Float64Array |
| 3   | P1  | [#768](https://github.com/danielsimonjr/MathTS/issues/768) | welchPSD empty for n&lt;256                       |
| 4   | P1  | [#769](https://github.com/danielsimonjr/MathTS/issues/769) | variance rejects `{ddof}`                         |
| 5   | P1  | [#771](https://github.com/danielsimonjr/MathTS/issues/771) | no skipna / nanmean                               |
| 6   | P1  | [#772](https://github.com/danielsimonjr/MathTS/issues/772) | gammaDist rate vs SciPy scale                     |
| 7   | P1  | [#773](https://github.com/danielsimonjr/MathTS/issues/773) | resample RangeError / not SciPy                   |
| 8   | P1  | [#774](https://github.com/danielsimonjr/MathTS/issues/774) | no fft on signal; split real/imag                 |
| 9   | P2  | [#775](https://github.com/danielsimonjr/MathTS/issues/775) | empty median/mode throw                           |
| 10  | P2  | [#776](https://github.com/danielsimonjr/MathTS/issues/776) | var(1e308×3) NaN                                  |
| 11  | P2  | [#777](https://github.com/danielsimonjr/MathTS/issues/777) | kendalltau p asymptotic vs exact                  |
| 12  | P2  | [#778](https://github.com/danielsimonjr/MathTS/issues/778) | quantileSeq `{method}`                            |
| 13  | P2  | [#779](https://github.com/danielsimonjr/MathTS/issues/779) | windowFunction arg order                          |
| 14  | P2  | [#780](https://github.com/danielsimonjr/MathTS/issues/780) | PNG needs rsvg on PATH                            |
| 15  | P2  | [#781](https://github.com/danielsimonjr/MathTS/issues/781) | describe missing std/quartiles                    |
| 16  | P2  | [#782](https://github.com/danielsimonjr/MathTS/issues/782) | sample vs sampleN docs                            |
| 17  | P2  | [#783](https://github.com/danielsimonjr/MathTS/issues/783) | KS string cdf                                     |
| 18  | P2  | [#784](https://github.com/danielsimonjr/MathTS/issues/784) | heatmap no colorbar                               |
| 19  | P2  | [#785](https://github.com/danielsimonjr/MathTS/issues/785) | variance typed unknown                            |
| 20  | P2  | [#786](https://github.com/danielsimonjr/MathTS/issues/786) | pearsonr pValue 0                                 |
| dup |     | #714 #712 #726 #697 #706                                   | comment 403                                       |

Intended labels on every new issue (token cannot apply them): `dogfood` + `bug|api|perf|docs|packaging` + `P0|P1|P2` + `persona:data-scientist`. First line of each body is `Labels: …`.

## Verdict

I can get through a **clean numeric vector** of `number[]`: means, unbiased variance, linear quantiles, excess kurtosis, ANOVA, hypergeometric, N(0,1), workbook gauss-sum, and SVG plots all match the oracles I trust. I **cannot** drop in a pandas/SciPy notebook without hitting a silent NaN t-test, typed-array holes, NaN-policy gaps, Gamma scale, Welch defaults, and a signal FFT that does not look like `numpy.fft`. I did not patch any of this.

No code fixes this round.
