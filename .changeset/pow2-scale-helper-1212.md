---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Internal refactor, no change in behaviour (Refs #1212). The matrix `qr` and `qrPivoted` scale R back with the shared `scaleDense` helper in `operations/common.ts`, which the WASM backend also uses. The functions `qr` runs its number path and its Complex path through one scaled call.
