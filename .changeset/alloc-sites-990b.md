---
'@danielsimonjr/mathts-functions': minor
---

Window functions, frequency grids, special matrices, sample generators, filter designs, curve fits and a few other functions check the size of the result before they allocate, and throw a `RangeError` instead of hanging or running out of memory (Refs #990). `toSamples` (not public) gives one array check to the signal and curve-fit functions. `medfilt` clamps a window longer than the signal. `stirlingS2` with a long `n` and a small `k` no longer builds a table of `n` rows, so `stirlingS2(1e6, 2)` returns `Infinity` with a small heap.

BREAKING:

- A result of more than 100000000 elements throws `RangeError` from the ten window functions (`blackmanHarrisWindow(1e9)`), `fftfreq`, `rfftfreq`, `unitImpulse`, `firwin`, `stepResponse`, `impulseResponse`, `wiener` (window size), `histogram` (bins plus one), `parallelStatHistogram`, `rootsChebyshevT`, `rootsChebyshevU`, `chirpZTransform` (`m`), `resample` (both modes), `lowpassFilter`, `highpassFilter` and `bandpassFilter` (order), `vander`, `hilbertMatrix`, `invHilbertMatrix`, `pascalMatrix`, `helmertMatrix`, `adjacencyMatrix`, `dirichletSample`, `mvnSample`, `diag` (dense result) and `nthRoots`.
- `dftMatrix(n)` throws above `n = 3535`, because each entry is a `Complex` object (counted as eight elements).
- `nthRoots(x, root)` throws above `root = 12500000`.
- `kaiserWindow(n, beta)` throws `RangeError` for `n > 1000000`.
- `butter`, `cheby1` and `cheby2` throw `RangeError` for an order above 1000 (`butter(1e4, 0.2)` took about 38 s and returned NaN coefficients).
- `pickRandom(array, n)` and `quantileSeq(data, N)` throw `RangeError` above 10000000.
- `format(x, precision)` and `format(x, { precision })` throw `RangeError` for a precision above 1000000.
- `bartlettPSD(5)`, `welchPSD(5)`, `multiTaperPSD(5)`, `goertzel(4, 1, 8)`, `chirpZTransform(5, 3)`, `resample(5, 4)`, `newtonInterp(2, 2, 1)`, `polyFit(2, 2, 1)`, `chebyshevFit`, `legendreFit` and `polymul(3, 3)` threw nothing before and now throw `TypeError` (`signal must be an array or a Float64Array`). A number argument used to become an array of zeros.
