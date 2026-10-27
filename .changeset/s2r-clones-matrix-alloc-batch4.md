---
'@danielsimonjr/mathts-matrix': patch
---

Sprint 2R: deduplicate matrix WASM allocation helpers (`allocHeader`, `allocateAs`/`makeAs`) and parallel dense-matrix pair dispatch (`densePair` for add/subtract/hadamard/divide). Public behavior unchanged; AS Int32 type id 4 vs 6 stays file-local.
