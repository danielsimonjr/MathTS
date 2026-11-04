---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts opt-in `simplify` (`'off' | 'constants' | 'algebraic'`, default `'off'`). `'constants'` runs the existing `simplifyConstants` on each seed and each bred offspring before the grammar check and the score; `'algebraic'` runs the existing `simplifyScalar`. When `simplifyScalar` throws `ScalarBuildError` or `RangeError`, or its result fails the grammar (including `admit`), or row-wise evaluation on positively weighted rows disagrees with the original, the tree keeps its unsimplified shape. Simplification runs once per seed or offspring, before the refit coin. Enumerated trees are not simplified. Simplification draws no randomness, but different accepted trees can change mutation outcomes relative to `'off'`; two runs with the same mode and seed still match. `ScalarSearchResult.simplifyFallbacks` counts unsimplified fallbacks. Omitted, the seed-7 pin is unchanged.
