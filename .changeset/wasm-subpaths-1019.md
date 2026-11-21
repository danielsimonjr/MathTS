---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-wasm': minor
---

The binaries `mathts.wasm` and `mathts-debug.wasm` of the package have no import any more. The build sets `use: ["abort="]` in `asconfig.json`, so an abort is a trap and no host function `env.abort` is necessary. Node reads each import of a WebAssembly module as a package name, so `import('@danielsimonjr/mathts-wasm/wasm')` failed with `ERR_MODULE_NOT_FOUND`. Now Node loads both binary subpaths as WebAssembly ES modules (Node 22.12 needs `--experimental-wasm-modules`; Bun returns the file path as `default`), and any runtime instantiates them with an empty import object. The subpaths `./wasm` and `./debug` have a `default` condition, so `require.resolve` finds the files. The new subpath `./debug.js` exports the glue of the debug build. An abort now traps as `WebAssembly.RuntimeError` (`unreachable` in V8); the abort message and the file position are not available. `functions` and `matrix` ship the rebuilt binary (62928 bytes, no import). An abort that a call of their WASM tier reaches is now a `WebAssembly.RuntimeError` (`unreachable`); it was `Error` with the message `WASM abort` and a `console.error` line. (Refs #1019)
