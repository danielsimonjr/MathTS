---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts opt-in `simplify` (`'off' | 'constants' | 'algebraic'`, default `'off'`). `'constants'` runs the existing `simplifyConstants` on each seed and each bred offspring before the grammar check and the score; `'algebraic'` runs the existing `simplifyScalar`. When `simplifyScalar` throws `ScalarBuildError`, or its result fails the grammar (including `admit`), the tree keeps its unsimplified shape. Simplification runs once per tree, before the refit coin, so the scored tree is the tree whose parameters are fitted. Omitted, the seed-7 pin is unchanged.
