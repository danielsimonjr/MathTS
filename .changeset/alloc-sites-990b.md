---
'@danielsimonjr/mathts-functions': minor
---

Window functions, frequency grids, special matrices, sample generators, filter designs, curve fits and a few other functions check the size of the result before they allocate, and throw a `RangeError` instead of hanging or running out of memory (Refs #990). `toSamples` (not public) gives one array check to the signal and curve-fit functions. Typed arrays (`Float32Array`, `Int32Array`, `Uint8Array` and the other number typed arrays) stay accepted by the signal and curve-fit functions. `medfilt` clamps a window longer than the signal: `medfilt([1, 5, 2, 8, 3], 1e9)` gives `[3, 3, 3, 3, 3]`, the same as window 9. `stirlingS2` with a long `n` and a small `k` no longer builds a table of `n` rows, so `stirlingS2(1e6, 2)` returns `Infinity` with a small heap. A number `stirlingS2` stops when the result is `Infinity`. A BigNumber `bellNumbers` uses the Bell triangle, so `bellNumbers(bignumber(1100))` takes about 2.5 s.

BREAKING:

- A result of more than 100000000 elements throws `RangeError` from the ten window functions (`blackmanHarrisWindow(1e9)`), `fftfreq`, `rfftfreq`, `unitImpulse`, `firwin`, `stepResponse`, `impulseResponse`, `wiener` (window size), `histogram` (bins plus one), `parallelStatHistogram`, `rootsChebyshevT`, `rootsChebyshevU`, `chirpZTransform` (`m`), `resample` (both modes), `lowpassFilter`, `highpassFilter` and `bandpassFilter` (order), `vander`, `hilbertMatrix`, `invHilbertMatrix`, `pascalMatrix`, `helmertMatrix`, `adjacencyMatrix`, `dirichletSample`, `mvnSample`, `diag` (dense result) and `nthRoots`.
- `dftMatrix(n)` throws above `n = 3535`, because each entry is a `Complex` object (counted as eight elements). `freqz(b, a, n)` counts eight elements for each point, so it throws above `n = 12500000`.
- `nthRoots(x, root)` throws above `root = 12500000`.
- `kaiserWindow(n, beta)` throws `RangeError` for `n > 1000000`.
- `butter`, `cheby1` and `cheby2` throw `RangeError` for an order above 1000 (`butter(1e4, 0.2)` took about 38 s and returned NaN coefficients).
- `pickRandom(array, n)` and `quantileSeq(data, N)` throw `RangeError` above 10000000.
- `format(x, precision)`, `format(x, { precision })` and `print(template, values, precision)` throw `RangeError` for a precision above 10000000.
- `windowFunction`, `getWindow` (classic names) and `freqz` (a number of points) throw `RangeError` for a result of more than 100000000 elements. `random(size)` and `randomInt(size)` throw `RangeError` for a size of more than 100000000 elements (`random([1e5, 1e5])`).
- `firls(numtaps, ...)` throws `RangeError` for `numtaps > 3001`. `pascalMatrix(n)` throws above `n = 2000`, and `invHilbertMatrix(n)` throws above `n = 1000`.
- `dirichletSample` and `mvnSample` count `k + 8` elements per sample, so `dirichletSample([1, 1], 2e7)` throws `RangeError`.
- A BigNumber `stirlingS2(n, k)` throws `RangeError` when `(n + 1) * (k + 1)` is more than 300000 (for example `stirlingS2(bignumber(1000), bignumber(998))`). Below that limit, a BigNumber `stirlingS2(n, n)` returns BigNumber 1 (it returned number 1); above it, for `n > 546`, it throws.
- `bartlettPSD(5)`, `welchPSD(5)`, `multiTaperPSD(5)`, `goertzel(4, 1, 8)`, `chirpZTransform(5, 3)`, `resample(5, 4)` and `polymul(3, 3)` threw nothing before and now throw `TypeError` (`signal must be an array or a typed array`). A number argument used to become an array of zeros. `newtonInterp(2, 2, 1)`, `polyFit(2, 2, 1)`, `chebyshevFit` and `legendreFit` with number arguments threw a different error before (duplicate x-values or a rank-deficient system) and now throw the `TypeError`. A Matrix, a string, a `Set`, a `BigInt64Array`, an array-like object, `null` or `undefined` also throws `TypeError` (a Matrix, `null` or `undefined` used to give an empty or NaN result). An `ArrayBuffer` or a `DataView` also throws: an `ArrayBuffer` used to be read as a Float64Array (`goertzel(buffer, 2, 8)` gave a result); pass `new Float64Array(buffer)` instead.
