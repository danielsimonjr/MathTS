---
'@danielsimonjr/mathts-functions': patch
---

Fix `zeta` at negative arguments and improve `besselK` in the transition band

A fresh sweep of the special-function surface against mpmath (dps=50) and SciPy found everything
already machine-precision (gamma/erf/digamma/elliptic/besselJ·I, and every distribution CDF/quantile
even deep in the tails) — except two spots:

- **`zeta` at negative real arguments** was up to **1.5e-7** off (`zeta(-3)`, exact 1/120): the direct
  Borwein series cancels catastrophically for negative `Re(s)` (its terms grow like `k^|Re s|`). It now
  reflects through the functional equation for `Re(s) < 0` — routing to `zeta(1-s)` with `Re > 1` where
  the series is most accurate — bringing negative arguments to **~1.9e-14** (machine precision).
  Positive, critical-strip, and complex values are unchanged.

- **`besselK` in the series/asymptotic transition band (x≈8–11)**: the K0/K1 ascending series subtracts
  two `O(I0(x))` terms, so its cancellation error grows with x (~5.3e-9 at the old x=9 crossover). Moving
  the crossover to x=8 (where the asymptotic has overtaken it) caps the peak at **~1.6e-9** (~3× better).
  K is machine-precision below x=5 and above x=15.

Pinned against mpmath references in `functions/tests/special-accuracy.test.ts`.
