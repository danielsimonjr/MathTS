---
'@danielsimonjr/mathts-functions': patch
---

**Fix `expand` distribution bug + add a CAS-vs-sympy oracle (GC11).** `expand('(x + 1)*(x - 2)')` returned `x*x - 2 + 1*x - 2` (value x²+x−4) instead of the correct x²−x−2 — it split each factor on `+` only, so `x - 2` stayed a single term and the `−2` dangled through distribution. Fixed by normalizing binary subtraction to a signed additive term (`x - 2` → `["x", "-2"]`) before distributing. Surfaced by a new external-oracle test (`gap-cas-sympy-oracle.test.ts`) that pins `derivative`/`simplify`/`expand`/`factor`/`rationalize` to **sympy 1.14.0** by numeric agreement at sample points — the implementation-independent discipline (never assert a CAS result against its own re-serialization).
