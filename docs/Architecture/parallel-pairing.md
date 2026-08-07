<!-- repo-map:no-verification -->
<!-- GENERATED FILE -- do not edit by hand.
     Regenerate with `npm run docs:deps:full`. -->

# Parallel (Worker-Pool) ↔ Function Pairing

**Generated**: 2026-08-07 (by tools/create-dependency-graph)

Per public `mathTyped` function in `functions/src/typed/`, its worker-pool routing: a **named op** (`computePool.<op>()`, which consults a tunable threshold) or a **generic kernel** path (`applyKernel`/`mapArray`/`shouldParallelize`/a bare `parallel*` helper — gated by the global `thresholdElements`). A function counts as **effective** when at least one of its ops has a threshold ≠ `'never'`, and **disabled** when every op it touches is `'never'` (wired to the pool but always runs inline JS — the parallel analog of a WASM js-fallback).

> Detection is per-`mathTyped`-block direct references; parallelism reached only via helper functions outside the block is not traced, so this can under-report. Thresholds are parsed from `parallel/src/ComputePool.ts` (`DEFAULT_THRESHOLD_BY_OP` + `thresholdElements`).

| Routing                                    |   Count |
| ------------------------------------------ | ------: |
| Parallel — effective (op threshold active) |      82 |
| Parallel — disabled (all ops `'never'`)    |      31 |
| Non-parallel (no worker-pool path)         |     106 |
| **Total**                                  | **219** |

Global fallback threshold (`thresholdElements`, for ops absent from the per-op map): **50000** elements.

## Effectively parallelized functions

| Function                | Ops                           | Thresholds (elements)                 | Module        |
| ----------------------- | ----------------------------- | ------------------------------------- | ------------- |
| `acos`                  | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `acosh`                 | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `airyAi`                | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `airyBi`                | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `asin`                  | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `asinh`                 | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `atan`                  | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `atanh`                 | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `bernoulliPMF`          | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `besselI`               | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselJ`               | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselJ0`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselJ1`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselK`               | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselY`               | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselY0`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `besselY1`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `beta`                  | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `betainc`               | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `binomialPMF`           | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `cbrt`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `ceil`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `chebyshevT`            | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `cosh`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `cosIntegral`           | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `cot`                   | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `csc`                   | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `cube`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `digamma`               | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `ellipticE`             | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `ellipticK`             | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `erfc`                  | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `erfi`                  | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `expIntegralEi`         | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `expm1`                 | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `exponentialCDF`        | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `exponentialPDF`        | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `fix`                   | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `floor`                 | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `fresnelC`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `fresnelS`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `gammainc`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `gammaincp`             | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `geometricPMF`          | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `hermiteH`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `laguerreL`             | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `lambertW`              | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `legendreP`             | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `lgamma`                | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `log10`                 | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `log1p`                 | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `log2`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `logIntegral`           | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `max`                   | `applyKernel`, `max`          | 50000 (global kernel), never          | arithmetic    |
| `min`                   | `applyKernel`, `min`          | 50000 (global kernel), never          | arithmetic    |
| `norm`                  | `applyKernel`, `norm`         | 50000 (global kernel), never          | arithmetic    |
| `normalCDF`             | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `normalPDF`             | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `parallelAutoCorr`      | `applyKernel`                 | 50000 (global kernel)                 | signal        |
| `parallelConv`          | `applyKernel`, `fftBatch`     | 50000 (global kernel), 50000 (global) | signal        |
| `parallelFFT`           | `applyKernel`                 | 50000 (global kernel)                 | signal        |
| `parallelFFTMagnitude`  | `applyKernel`, `applyKernel2` | 50000 (global kernel), 50000 (global) | signal        |
| `parallelFFTPower`      | `applyKernel`, `applyKernel2` | 50000 (global kernel), 50000 (global) | signal        |
| `parallelIFFT`          | `applyKernel`                 | 50000 (global kernel)                 | signal        |
| `parallelStatCorr`      | `applyKernel`, `variance`     | 50000 (global kernel), never          | statistics    |
| `parallelStatHistogram` | `applyKernel`, `histogram`    | 50000 (global kernel), never          | statistics    |
| `parallelStatMAD`       | `applyKernel`, `mean`         | 50000 (global kernel), never          | statistics    |
| `parallelStatMedian`    | `applyKernel`                 | 50000 (global kernel)                 | statistics    |
| `parallelStatMode`      | `applyKernel`                 | 50000 (global kernel)                 | statistics    |
| `parallelStatNorm`      | `applyKernel`, `norm`         | 50000 (global kernel), never          | statistics    |
| `parallelStatProd`      | `applyKernel`, `prod`         | 50000 (global kernel), never          | statistics    |
| `parallelStatQuantile`  | `applyKernel`                 | 50000 (global kernel)                 | statistics    |
| `parallelStatStd`       | `applyKernel`, `std`          | 50000 (global kernel), never          | statistics    |
| `parallelStatVariance`  | `applyKernel`, `variance`     | 50000 (global kernel), never          | statistics    |
| `parallelXCorr`         | `applyKernel`                 | 50000 (global kernel)                 | signal        |
| `poissonPMF`            | `applyKernel`                 | 50000 (global kernel)                 | distributions |
| `round`                 | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `sec`                   | `applyKernel`                 | 50000 (global kernel)                 | trigonometry  |
| `sign`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `sinh`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |
| `sinIntegral`           | `applyKernel`                 | 50000 (global kernel)                 | special       |
| `tanh`                  | `applyKernel`                 | 50000 (global kernel)                 | arithmetic    |

## Disabled parallel paths (wired but always inline JS)

These route to the worker pool but every op resolves to `'never'` — overhead dominated at all benchmarked sizes, so they always run inline JS today. Kept wired so a future threshold retune (`tools/benchmark/parallel/run.ts`) can switch them on without code churn.

| Function               | Ops (all `'never'`) | Module       |
| ---------------------- | ------------------- | ------------ |
| `abs`                  | `abs`               | arithmetic   |
| `add`                  | `add`               | arithmetic   |
| `bitAnd`               | `bitAnd`            | bitwise      |
| `bitNot`               | `bitNot`            | bitwise      |
| `bitOr`                | `bitOr`             | bitwise      |
| `bitXor`               | `bitXor`            | bitwise      |
| `cos`                  | `cos`               | trigonometry |
| `divide`               | `divide`            | arithmetic   |
| `dot`                  | `dot`               | arithmetic   |
| `exp`                  | `exp`               | arithmetic   |
| `leftShift`            | `leftShift`         | bitwise      |
| `log`                  | `log`               | arithmetic   |
| `mean`                 | `mean`              | arithmetic   |
| `multiply`             | `multiply`, `scale` | arithmetic   |
| `parallelStatDistance` | `distance`          | statistics   |
| `parallelStatMax`      | `max`               | statistics   |
| `parallelStatMean`     | `mean`              | statistics   |
| `parallelStatMin`      | `min`               | statistics   |
| `parallelStatMinMax`   | `minMax`            | statistics   |
| `parallelStatSum`      | `sum`               | statistics   |
| `rightArithShift`      | `rightArithShift`   | bitwise      |
| `rightLogShift`        | `rightLogShift`     | bitwise      |
| `sin`                  | `sin`               | trigonometry |
| `sqrt`                 | `sqrt`              | arithmetic   |
| `square`               | `square`            | arithmetic   |
| `std`                  | `variance`          | arithmetic   |
| `subtract`             | `subtract`          | arithmetic   |
| `sum`                  | `sum`               | arithmetic   |
| `tan`                  | `tan`               | trigonometry |
| `unaryMinus`           | `negate`            | arithmetic   |
| `variance`             | `variance`          | arithmetic   |

## Per-module counts

| Module        | Effective | Disabled | Non-parallel |
| ------------- | --------: | -------: | -----------: |
| arithmetic    |        17 |       15 |           14 |
| bitwise       |         0 |        7 |            0 |
| combinatorics |         0 |        0 |           21 |
| complex       |         0 |        0 |            4 |
| distributions |         8 |        0 |            6 |
| logical       |         0 |        0 |            5 |
| matrix-ops    |         0 |        0 |            9 |
| probability   |         0 |        0 |            8 |
| relational    |         0 |        0 |            7 |
| set           |         0 |        0 |           10 |
| signal        |         7 |        0 |            0 |
| special       |        31 |        0 |            7 |
| statistics    |        10 |        6 |            1 |
| string        |         0 |        0 |            5 |
| trigonometry  |         9 |        3 |            7 |
| unit          |         0 |        0 |            2 |

## Canonical op thresholds

Parsed from `parallel/src/ComputePool.ts` (`DEFAULT_THRESHOLD_BY_OP`). `# functions` counts public typed functions dispatching through each op (0 ⇒ the op is exposed by the pool but not reached from the scanned typed API — e.g. used only by the matrix package or internal helpers). `applyKernel` is the synthetic generic-kernel path.

| Op                         | Threshold (elements)  | Active? | # functions |
| -------------------------- | --------------------- | :-----: | ----------: |
| `abs`                      | never                 |    —    |           1 |
| `add`                      | never                 |    —    |           1 |
| `applyKernel`              | 50000 (global kernel) |    ✓    |          82 |
| `applyKernel2`             | 50000 (global)        |    ✓    |           2 |
| `besselJ`                  | 1000000               |    ✓    |           0 |
| `bitAnd`                   | never                 |    —    |           1 |
| `bitNot`                   | never                 |    —    |           1 |
| `bitOr`                    | never                 |    —    |           1 |
| `bitXor`                   | never                 |    —    |           1 |
| `characteristicPolynomial` | 9216                  |    ✓    |           0 |
| `chiSquareTest`            | 4096                  |    ✓    |           0 |
| `cos`                      | never                 |    —    |           1 |
| `distance`                 | never                 |    —    |           1 |
| `distanceMatrix`           | never                 |    —    |           0 |
| `divide`                   | never                 |    —    |           1 |
| `dot`                      | never                 |    —    |           1 |
| `erfc`                     | 100000                |    ✓    |           0 |
| `exp`                      | never                 |    —    |           1 |
| `fft2d`                    | never                 |    —    |           0 |
| `fftBatch`                 | 50000 (global)        |    ✓    |           1 |
| `histogram`                | never                 |    —    |           1 |
| `integrateChunk`           | never                 |    —    |           0 |
| `kolmogorovSmirnovTest`    | 4096                  |    ✓    |           0 |
| `leftShift`                | never                 |    —    |           1 |
| `log`                      | never                 |    —    |           1 |
| `mannWhitneyTest`          | 4096                  |    ✓    |           0 |
| `matmul`                   | 4096                  |    ✓    |           0 |
| `matrixPower`              | 9216                  |    ✓    |           0 |
| `matvec`                   | never                 |    —    |           0 |
| `max`                      | never                 |    —    |           2 |
| `mean`                     | never                 |    —    |           3 |
| `min`                      | never                 |    —    |           2 |
| `minMax`                   | never                 |    —    |           1 |
| `multiply`                 | never                 |    —    |           1 |
| `negate`                   | never                 |    —    |           1 |
| `norm`                     | never                 |    —    |           2 |
| `normalCDF`                | never                 |    —    |           0 |
| `outer`                    | never                 |    —    |           0 |
| `parallelConv`             | never                 |    —    |           0 |
| `parallelFFT`              | never                 |    —    |           0 |
| `parallelStatProd`         | never                 |    —    |           0 |
| `pow`                      | never                 |    —    |           0 |
| `prod`                     | never                 |    —    |           1 |
| `rightArithShift`          | never                 |    —    |           1 |
| `rightLogShift`            | never                 |    —    |           1 |
| `sampleChunk`              | 100000                |    ✓    |           0 |
| `scale`                    | never                 |    —    |           1 |
| `shapiroWilkTest`          | 4096                  |    ✓    |           0 |
| `sign`                     | never                 |    —    |           0 |
| `sin`                      | never                 |    —    |           1 |
| `spectrogram`              | 65536                 |    ✓    |           0 |
| `sqrt`                     | never                 |    —    |           1 |
| `square`                   | never                 |    —    |           1 |
| `std`                      | never                 |    —    |           1 |
| `subtract`                 | never                 |    —    |           1 |
| `sum`                      | never                 |    —    |           2 |
| `tan`                      | never                 |    —    |           1 |
| `tensordot`                | 8192                  |    ✓    |           0 |
| `transpose`                | never                 |    —    |           0 |
| `variance`                 | never                 |    —    |           4 |

## Non-parallel functions (no worker-pool path)

Pure-JS or WASM-only typed functions — see `wasm-pairing.md` for their WASM routing.

`acot`, `acsc`, `and`, `arg`, `asec`, `atan2`, `bernoulli`, `betaPDF`, `bin`, `carlsonRC`, `carlsonRD`, `carlsonRF`, `carlsonRJ`, `carmichaelLambda`, `chineseRemainder`, `combinations`, `combinationsWithRep`, `compare`, `compareNatural`, `compareText`, `compareUnits`, `cond`, `conj`, `deepEqual`, `divisorSigma`, `divisors`, `doubleFactorial`, `ellipticEIncomplete`, `ellipticF`, `ellipticPi`, `entropy`, `equal`, `equalScalar`, `equalText`, `eulerPhi`, `fallingFactorial`, `fibonacci`, `format`, `fsum`, `gammaPDF`, `gcd`, `harmonicNumber`, `hex`, `hypot`, `im`, `integerDigits`, `jacobiSymbol`, `jsDivergence`, `larger`, `largerEq`, `lcm`, `lowRankApprox`, `lucas`, `lucasL`, `matrixExpm`, `matrixLogm`, `matrixSqrtm`, `mod`, `moebiusMu`, `multinomial`, `nextPrime`, `noncentralChi2PDF`, `norm2`, `normFro`, `not`, `nthRoot`, `nullish`, `oct`, `or`, `parallelStatCumsum`, `partitions`, `permutations`, `pickRandom`, `pinv`, `pow`, `prime`, `primeFactors`, `primePi`, `print`, `random`, `randomInt`, `re`, `risingFactorial`, `setCartesian`, `setDifference`, `setDistinct`, `setIntersect`, `setIsSubset`, `setMultiplicity`, `setPowerset`, `setSize`, `setSymDifference`, `setUnion`, `singularValues`, `smaller`, `smallerEq`, `studentTPDF`, `subfactorial`, `to`, `toBest`, `toDegrees`, `toRadians`, `unaryPlus`, `unequal`, `xgcd`, `xor`

> Notes: element-wise arithmetic/transcendental ops (`add`/`sin`/`exp`/…) and the signal/reduction ops are `'never'` — the 2026-05 parallel benchmark found worker overhead dominates at every tested size for memory-bound element-wise work. The active set is the compute-bound ops (tensordot, matmul, matrixPower, characteristicPolynomial, the hypothesis tests, and the special functions erfc/besselJ/spectrogram/sampleChunk) plus any generic `applyKernel` path above the 50000-element global threshold. Re-tune via `tools/benchmark/parallel/run.ts`.
