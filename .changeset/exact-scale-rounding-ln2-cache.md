---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-units': patch
---

Exact-scale follow-ups after #346:

- **`exactScaleToNumber` rounds correctly at any magnitude.** The old decimal-sticky path mis-rounded values above about 1e41 (just-above-midpoint cases rounded down). Rounding is now integer base-2 (53-bit significand + ties to even), including subnormals and overflow to Infinity.
- **Conversions that still hold their exact SI reading round the A→B ratio once.** A number-valued `Unit` built from a built-in exact unit keeps `_exactSI`; `toNumeric(other)` uses `reading × fromScale / toScale` rounded once. If the SI double was mutated (arithmetic, `splitUnit`, …), it falls back to rounding the current SI double. `createUnit` / non-exact units stay on the float route.
- **`ExactScale` carries `ln2` as well as `pi`.** Scale expressions accept `ln2`; `LN2_EXACT_SCALE` is exported. This unblocks units like `nat` (see #347) without embedding ln 2 as a float.
- **`exactScaleToNumber` memoizes** by `{num,den,pi,ln2}` (about 30× faster on repeated lookups in a local bench: ~16.4 µs → ~0.55 µs/op).
