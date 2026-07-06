---
'@danielsimonjr/mathts-functions': patch
---

**Fix `zeta` on the line Re=1 + add a complex-ζ oracle (GC6).** `zetaComplex` returned `NaN` for the _entire_ vertical line Re=1, but the simple pole is only the point s=1 — `ζ(1+it)` for `t≠0` is finite (e.g. `ζ(1+i) = 0.5822 − 0.9268i`). Fixed the guard (`s.re === 1` → `s.re === 1 && s.im === 0`). Added `gap-zeta-complex-oracle.test.ts` pinning `ζ(complex)` to **mpmath 1.3.0** (dps=40) across all three regions — convergent Re>1, the critical strip, and Re<1 via the functional equation — plus the pole and the first two nontrivial zeros on Re=1/2. Measured accuracy ~1e-14 (convergent/strip), ~1e-11 (reflection); the complex path was already implemented (Gourdon–Sebah / Borwein) but had no external oracle.
