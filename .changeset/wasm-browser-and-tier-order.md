---
'@danielsimonjr/mathts-functions': patch
---

**Fix: WASM was dead in the browser — and it invalidated the GPU tier's ordering.**

`elementwiseChainDispatch` returned `null` for every call in a browser, so browser users
silently got the pure-JS scalar path and the WASM tier never ran. Root cause:
`WasmLoader.getDefaultWasmPath()`'s browser branch made a single relative-URL guess
(`new URL('./wasm/<file>', import.meta.url)`) with no fallback, while the Node branch walks
parent directories until it finds the binary. The guess resolved to a path that never
existed, and the bridge's never-throw contract swallowed the failure as a `null` — so it
failed silently. Added `resolveBrowserWasm()`, the browser counterpart to the Node resolver,
probing the same candidate shapes with `fetch(HEAD)`. The SHA-384 integrity check is
untouched: this only changes _where_ the loader looks, never whether the tamper check runs.

**Consequence — `fuseUnaryChainAsync` tier order corrected to WASM → GPU → JS.** The GPU tier
had been benchmarked at "2.3–2.9× faster", but only because its CPU baseline was JS _because
WASM was dead_. With WASM actually loading (Chrome, NVIDIA Pascal, chain `sin→exp→tanh→cos`):
WASM is **~1.9× FASTER than the GPU** (16ms vs 30ms at n=65,536; 254ms vs 470ms at n=1M) —
and f64-exact where the GPU is f32. For element-wise chains the GPU is therefore both slower
and less precise, so it must never pre-empt WASM. It still earns its place where WASM cannot
load (~2–2.5× over JS there), and still wins decisively on compute-bound work like a large
`gpuMatmul`. Pinned by `gpu-vs-wasm.browser.test.ts`, which fails loudly on regression.
