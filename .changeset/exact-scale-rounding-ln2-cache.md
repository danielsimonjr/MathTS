---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-units': patch
---

Exact-scale follow-ups after #346:

- **`exactScaleToNumber` rounds correctly at any magnitude.** The old decimal-sticky path mis-rounded values above about 1e41 (just-above-midpoint cases rounded down). Rounding is now integer base-2 (53-bit significand, ties to even). Values below the smallest normal double round on the fixed 2^-1074 grid, and values past the largest finite double overflow to Infinity at the tie.
- **Conversions that still hold their exact SI reading round the A→B ratio once.** A number-valued `Unit` built from a built-in exact unit keeps `_exactSI`; `to()` and `toNumeric(other)` use `reading × fromScale / toScale` rounded once. They use the stored quantity only while `value` is still the double it rounds to, so a unit changed by `abs()`, arithmetic, `splitUnit` or an assignment to `value` converts from its current SI double. `createUnit` / non-exact units stay on the float route.
- **`ExactScale` carries `ln2` as well as `pi`.** Scale expressions accept `ln2`; `LN2_EXACT_SCALE` is exported, and its constant holds 120 correct decimal places. The Fraction and BigNumber routes give no exact value for a scale with an ln 2 factor, so those callers use the float route. This lets units such as `nat` and `bit` carry ln 2 without embedding it as a float (see #347).
- **`exactScaleToNumber` memoizes** by `{num,den,pi,ln2}`. The memo is bounded at 4096 results, and the least recently used result leaves first.
