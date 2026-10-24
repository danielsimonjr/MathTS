---
'@danielsimonjr/mathts-wasm': patch
---

Stop shipping unused TypeScript `MathTSWasm` bindings; consumers load the binary via `functions` and `matrix` loaders with SHA-384 verification.
