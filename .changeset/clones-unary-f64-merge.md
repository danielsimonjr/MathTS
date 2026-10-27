---
'@danielsimonjr/mathts-functions': patch
---

Consolidate duplicated unary `Float64Array` typed overloads (`mapUnaryFloat64` / `mapBinaryF64` in `parallel-map.ts`) for arithmetic, trigonometry, and FFT magnitude/power helpers. Behavior and worker kernel source strings are unchanged; WASM elementwise dispatch is still checked once per call.
