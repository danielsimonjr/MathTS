---
'@danielsimonjr/mathts-wasm': patch
---

`round_f64` rounds a tie away from zero. Before, it used the WebAssembly instruction `nearest`, which rounds a tie to the even integer: `round_f64(0.5)` gave 0, `round_f64(2.5)` gave 2 and `round_f64(-2.5)` gave -2. Now `round_f64(0.5)` is 1, `round_f64(2.5)` is 3 and `round_f64(-2.5)` is -3. A zero input gives +0. The kernel has no configuration and applies no tolerance, so `round_f64(0.49999999999999994)` is 0, and the `round` of `@danielsimonjr/mathts-functions` gives 1 with its default `relTol`. No function of `functions`, `matrix`, `parallel`, `tensor`, `compat` or `expression` calls this kernel. (Refs #1028)
