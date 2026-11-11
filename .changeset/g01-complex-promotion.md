---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-compat': minor
---

Real scalar `log`, `pow`, `nthRoot`, `acosh`, `atanh`, `asin`, and `acos` now match mathjs complex promotion when `predictable` is false. Previously these returned `NaN` for many out-of-domain reals. `predictable: true` preserves real-only `Math.*` results. Compat inverse-trig shims delegate to functions instead of calling `Math.asin` directly.
