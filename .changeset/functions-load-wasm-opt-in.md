---
'@danielsimonjr/mathts-functions': minor
---

New `loadWasm()` / `isWasmLoaded()` exports: an explicit opt-in to the AssemblyScript tier. Nothing in the package loaded its WASM binary before, so every function always ran its JavaScript path even though the binary and its bridges shipped. `await loadWasm()` loads the packaged `mathts-as.wasm` after checking its SHA-384 manifest. It resolves `false` when the binary cannot be found (a later call may retry) and rejects when the binary fails the integrity check. Nothing changes for code that does not call it.
