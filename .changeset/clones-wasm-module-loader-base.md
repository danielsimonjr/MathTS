---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Extract shared `WasmModuleLoader` base (`load` / cached `loadModule` / `getImports`) from the byte-identical copies in `functions` and `matrix` into `core/src/wasm-loader.ts` (`/internal` only). SHA-384 verification stays in each package's Node/browser load paths.
