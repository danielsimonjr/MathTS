<!-- repo-map:no-verification -->
<!-- GENERATED FILE -- do not edit by hand.
     Regenerate with `npm run docs:deps:full`. -->

# Parallel (Worker-Pool) ↔ Function Pairing

**Generated**: 2026-11-13 (by tools/create-dependency-graph)

Per public `mathTyped` function in `functions/src/typed/`, its worker-pool routing: a **named op** (`computePool.<op>()`, which consults a tunable threshold) or a **generic kernel** path (`applyKernel`/`mapArray`/`shouldParallelize`/a bare `parallel*` helper — gated by the global `thresholdElements`). A function counts as **effective** when at least one of its ops has a threshold ≠ `'never'`, and **disabled** when every op it touches is `'never'` (wired to the pool but always runs inline JS — the parallel analog of a WASM js-fallback).

> Detection is per-`mathTyped`-block direct references; parallelism reached only via helper functions outside the block is not traced, so this can under-report. Thresholds are parsed from `parallel/src/ComputePool.ts` (`DEFAULT_THRESHOLD_BY_OP` + `thresholdElements`).

| Routing                                    |   Count |
| ------------------------------------------ | ------: |
| Parallel — effective (op threshold active) |      16 |
| Parallel — disabled (all ops `'never'`)    |       6 |
| Non-parallel (no worker-pool path)         |     194 |
| **Total**                                  | **216** |

Global fallback threshold (`thresholdElements`, for ops absent from the per-op map): **50000** elements.

## Effectively parallelized functions

| Function                | Ops                        | Thresholds (elements)                 | Module     |
| ----------------------- | -------------------------- | ------------------------------------- | ---------- |
| `parallelAutoCorr`      | `applyKernel`              | 50000 (global kernel)                 | signal     |
| `parallelConv`          | `applyKernel`, `fftBatch`  | 50000 (global kernel), 50000 (global) | signal     |
| `parallelFFT`           | `applyKernel`              | 50000 (global kernel)                 | signal     |
| `parallelFFTMagnitude`  | `applyKernel`              | 50000 (global kernel)                 | signal     |
| `parallelFFTPower`      | `applyKernel`              | 50000 (global kernel)                 | signal     |
| `parallelIFFT`          | `applyKernel`              | 50000 (global kernel)                 | signal     |
| `parallelStatCorr`      | `applyKernel`, `variance`  | 50000 (global kernel), never          | statistics |
| `parallelStatHistogram` | `applyKernel`, `histogram` | 50000 (global kernel), never          | statistics |
| `parallelStatMAD`       | `applyKernel`, `mean`      | 50000 (global kernel), never          | statistics |
| `parallelStatMedian`    | `applyKernel`              | 50000 (global kernel)                 | statistics |
| `parallelStatNorm`      | `applyKernel`, `norm`      | 50000 (global kernel), never          | statistics |
| `parallelStatProd`      | `applyKernel`, `prod`      | 50000 (global kernel), never          | statistics |
| `parallelStatQuantile`  | `applyKernel`              | 50000 (global kernel)                 | statistics |
| `parallelStatStd`       | `applyKernel`, `std`       | 50000 (global kernel), never          | statistics |
| `parallelStatVariance`  | `applyKernel`, `variance`  | 50000 (global kernel), never          | statistics |
| `parallelXCorr`         | `applyKernel`              | 50000 (global kernel)                 | signal     |

## Disabled parallel paths (wired but always inline JS)

These route to the worker pool but every op resolves to `'never'` — overhead dominated at all benchmarked sizes, so they always run inline JS today. Kept wired so a future threshold retune (`tools/benchmark/parallel/run.ts`) can switch them on without code churn.

| Function               | Ops (all `'never'`) | Module     |
| ---------------------- | ------------------- | ---------- |
| `parallelStatDistance` | `distance`          | statistics |
| `parallelStatMax`      | `max`               | statistics |
| `parallelStatMean`     | `mean`              | statistics |
| `parallelStatMin`      | `min`               | statistics |
| `parallelStatMinMax`   | `minMax`            | statistics |
| `parallelStatSum`      | `sum`               | statistics |

## Per-module counts

| Module        | Effective | Disabled | Non-parallel |
| ------------- | --------: | -------: | -----------: |
| arithmetic    |         0 |        0 |           43 |
| bitwise       |         0 |        0 |            7 |
| combinatorics |         0 |        0 |           21 |
| complex       |         0 |        0 |            4 |
| distributions |         0 |        0 |           14 |
| logical       |         0 |        0 |            5 |
| matrix-ops    |         0 |        0 |            9 |
| probability   |         0 |        0 |            8 |
| relational    |         0 |        0 |            7 |
| set           |         0 |        0 |           10 |
| signal        |         7 |        0 |            0 |
| special       |         0 |        0 |           38 |
| statistics    |         9 |        6 |            2 |
| string        |         0 |        0 |            5 |
| trigonometry  |         0 |        0 |           19 |
| unit          |         0 |        0 |            2 |

## Canonical op thresholds

Parsed from `parallel/src/ComputePool.ts` (`DEFAULT_THRESHOLD_BY_OP`). `# functions` counts public typed functions dispatching through each op (0 ⇒ the op is exposed by the pool but not reached from the scanned typed API — e.g. used only by the matrix package or internal helpers). `applyKernel` is the synthetic generic-kernel path.

| Op                         | Threshold (elements)  | Active? | # functions |
| -------------------------- | --------------------- | :-----: | ----------: |
| `abs`                      | never                 |    —    |           0 |
| `add`                      | never                 |    —    |           0 |
| `applyKernel`              | 50000 (global kernel) |    ✓    |          16 |
| `besselJ`                  | 1000000               |    ✓    |           0 |
| `bitAnd`                   | never                 |    —    |           0 |
| `bitNot`                   | never                 |    —    |           0 |
| `bitOr`                    | never                 |    —    |           0 |
| `bitXor`                   | never                 |    —    |           0 |
| `characteristicPolynomial` | 9216                  |    ✓    |           0 |
| `chiSquareTest`            | 4096                  |    ✓    |           0 |
| `cos`                      | never                 |    —    |           0 |
| `distance`                 | never                 |    —    |           1 |
| `distanceMatrix`           | never                 |    —    |           0 |
| `divide`                   | never                 |    —    |           0 |
| `dot`                      | never                 |    —    |           0 |
| `erfc`                     | 100000                |    ✓    |           0 |
| `exp`                      | never                 |    —    |           0 |
| `fft2d`                    | never                 |    —    |           0 |
| `fftBatch`                 | 50000 (global)        |    ✓    |           1 |
| `histogram`                | never                 |    —    |           1 |
| `integrateChunk`           | never                 |    —    |           0 |
| `kolmogorovSmirnovTest`    | 4096                  |    ✓    |           0 |
| `leftShift`                | never                 |    —    |           0 |
| `log`                      | never                 |    —    |           0 |
| `mannWhitneyTest`          | 4096                  |    ✓    |           0 |
| `matmul`                   | 7077888               |    ✓    |           0 |
| `matrixPower`              | 9216                  |    ✓    |           0 |
| `matvec`                   | never                 |    —    |           0 |
| `max`                      | never                 |    —    |           1 |
| `mean`                     | never                 |    —    |           2 |
| `min`                      | never                 |    —    |           1 |
| `minMax`                   | never                 |    —    |           1 |
| `multiply`                 | never                 |    —    |           0 |
| `negate`                   | never                 |    —    |           0 |
| `norm`                     | never                 |    —    |           1 |
| `normalCDF`                | never                 |    —    |           0 |
| `outer`                    | never                 |    —    |           0 |
| `parallelConv`             | never                 |    —    |           0 |
| `parallelFFT`              | never                 |    —    |           0 |
| `parallelStatProd`         | never                 |    —    |           0 |
| `pow`                      | never                 |    —    |           0 |
| `prod`                     | never                 |    —    |           1 |
| `rightArithShift`          | never                 |    —    |           0 |
| `rightLogShift`            | never                 |    —    |           0 |
| `sampleChunk`              | 100000                |    ✓    |           0 |
| `scale`                    | never                 |    —    |           0 |
| `shapiroWilkTest`          | 4096                  |    ✓    |           0 |
| `sign`                     | never                 |    —    |           0 |
| `sin`                      | never                 |    —    |           0 |
| `spectrogram`              | 65536                 |    ✓    |           0 |
| `sqrt`                     | never                 |    —    |           0 |
| `square`                   | never                 |    —    |           0 |
| `std`                      | never                 |    —    |           1 |
| `subtract`                 | never                 |    —    |           0 |
| `sum`                      | never                 |    —    |           1 |
| `tan`                      | never                 |    —    |           0 |
| `tensordot`                | 8192                  |    ✓    |           0 |
| `transpose`                | never                 |    —    |           0 |
| `variance`                 | never                 |    —    |           2 |

## Non-parallel functions (no worker-pool path)

Pure-JS or WASM-only typed functions — see `wasm-pairing.md` for their WASM routing.

`abs`, `acos`, `acosh`, `acot`, `acsc`, `airyAi`, `airyBi`, `and`, `arg`, `asec`, `asin`, `asinh`, `atan`, `atan2`, `atanh`, `bernoulli`, `bernoulliPMF`, `besselI`, `besselJ`, `besselJ0`, `besselJ1`, `besselK`, `besselY`, `besselY0`, `besselY1`, `beta`, `betaPDF`, `betainc`, `bin`, `binomialPMF`, `bitAnd`, `bitNot`, `bitOr`, `bitXor`, `carlsonRC`, `carlsonRD`, `carlsonRF`, `carlsonRJ`, `carmichaelLambda`, `cbrt`, `ceil`, `chebyshevT`, `chineseRemainder`, `combinations`, `combinationsWithRep`, `compare`, `compareNatural`, `compareText`, `compareUnits`, `cond`, `conj`, `cos`, `cosIntegral`, `cosh`, `cot`, `csc`, `cube`, `deepEqual`, `digamma`, `divide`, `divisorSigma`, `divisors`, `dot`, `doubleFactorial`, `ellipticE`, `ellipticEIncomplete`, `ellipticF`, `ellipticK`, `ellipticPi`, `entropy`, `equal`, `equalScalar`, `equalText`, `erfc`, `erfi`, `eulerPhi`, `exp`, `expIntegralEi`, `expm1`, `exponentialCDF`, `exponentialPDF`, `fallingFactorial`, `fibonacci`, `fix`, `floor`, `format`, `fresnelC`, `fresnelS`, `fsum`, `gammaPDF`, `gammainc`, `gammaincp`, `geometricPMF`, `harmonicNumber`, `hermiteH`, `hex`, `hypot`, `im`, `integerDigits`, `jacobiSymbol`, `jsDivergence`, `laguerreL`, `lambertW`, `larger`, `largerEq`, `lcm`, `leftShift`, `legendreP`, `lgamma`, `log`, `log10`, `log1p`, `log2`, `logIntegral`, `lowRankApprox`, `lucas`, `lucasL`, `matrixExpm`, `matrixLogm`, `matrixSqrtm`, `max`, `mean`, `min`, `mod`, `moebiusMu`, `multinomial`, `nextPrime`, `noncentralChi2PDF`, `norm`, `norm2`, `normFro`, `normalCDF`, `normalPDF`, `not`, `nthRoot`, `nullish`, `oct`, `or`, `parallelStatCumsum`, `parallelStatMode`, `partitions`, `permutations`, `pickRandom`, `pinv`, `poissonPMF`, `pow`, `prime`, `primeFactors`, `primePi`, `print`, `random`, `randomInt`, `re`, `rightArithShift`, `rightLogShift`, `risingFactorial`, `round`, `sec`, `setCartesian`, `setDifference`, `setDistinct`, `setIntersect`, `setIsSubset`, `setMultiplicity`, `setPowerset`, `setSize`, `setSymDifference`, `setUnion`, `sign`, `sin`, `sinIntegral`, `singularValues`, `sinh`, `smaller`, `smallerEq`, `sqrt`, `square`, `std`, `studentTPDF`, `subfactorial`, `subtract`, `sum`, `tan`, `tanh`, `to`, `toBest`, `toDegrees`, `toRadians`, `unaryMinus`, `unaryPlus`, `unequal`, `variance`, `xgcd`, `xor`

> Notes: element-wise arithmetic/transcendental ops (`add`/`sin`/`exp`/…) and the signal/reduction ops are `'never'` — the 2026-05 parallel benchmark found worker overhead dominates at every tested size for memory-bound element-wise work. The active set is the compute-bound ops (tensordot, matmul, matrixPower, characteristicPolynomial, the hypothesis tests, and the special functions erfc/besselJ/spectrogram/sampleChunk) plus any generic `applyKernel` path above the 50000-element global threshold. Re-tune via `tools/benchmark/parallel/run.ts`.
