---
'@danielsimonjr/mathts-matrix': patch
---

Fix matrix WASM JS-fallback determinant sign and Windows WASM-loader path.

- **`determinantJS` sign bug.** The JS fallback computed the permutation parity
  by counting positions where `perm[i] !== i`. That matches actual transposition
  count only when every cycle is a 2-cycle; for any 3-cycle (or larger) it gives
  the wrong parity. Replaced with cycle-decomposition: `sign(P) = (-1)^(n - cycles)`.
  Caught by `tests/wasm/decompositions-as.test.ts > matrix_determinant ...` for
  a 3×3 with a single 2-cycle that surfaced the off-by-`±2` regression.
- **Windows doubled-drive path.** `URL.pathname` of a `file:///C:/...` URL is
  `/C:/...`, which `fs.readFile` then resolves as drive-relative
  (`C:\C:\...`). All three callers (`WasmLoader.getDefaultWasmPath`,
  `RustWasmLoader.findWasmPath`, `WASMBackend.resolveAsWasmPath`) now use
  `fileURLToPath` for the Node branch, which is cross-platform correct and
  decodes URL %-escapes. Browser branches continue to return `.href` for
  `fetch()`.
