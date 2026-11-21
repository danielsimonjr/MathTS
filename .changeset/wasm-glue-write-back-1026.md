---
'@danielsimonjr/mathts-wasm': patch
---

The ESM glue of the package (`build/mathts.js`) now writes the output arguments of a kernel back to the caller. Before, the glue copied each typed array into wasm memory and never copied it back, so `matrix_multiply(a, 2, 2, b, 2, c)` left `c` at zeros and `array_scale_inplace([1, 2, 3], 2)` left its argument as it was. A kernel now writes back each parameter that it is contracted to write: an output buffer, an in-place buffer or a scratch buffer. The new step `scripts/patch-glue.mjs` of `gen:manifest` classifies every typed-array parameter of the 175 exports as `in` or `out` (87 `out`, 230 `in`), and the build fails when an export or a parameter is not in that list. The glue never writes an `in` parameter back. The debug glue throws `mathts glue: <export> wrote its input parameter <param>` when a kernel writes one. A plain Array works as an input and as an output. (Refs #1026)
