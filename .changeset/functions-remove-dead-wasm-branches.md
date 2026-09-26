---
'@danielsimonjr/mathts-functions': patch
---

Remove the legacy WASM branches that called 56 kernels the AssemblyScript binary does not export (`dct_wasm`, `laDet`, `statsMean`, `distanceND`, …). Whenever the module was loaded, each one copied its inputs into WASM memory that is never reclaimed, failed, and fell back to JavaScript; `distance` (pairwise) and `intersect` (2-D lines) threw `is not a function` instead. Results are unchanged, the exported names are unchanged, and the bundle is about 3,500 lines smaller.
