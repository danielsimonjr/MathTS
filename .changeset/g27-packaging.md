---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-functions': patch
---

Packaging (G27): neutral esbuild bundles no longer resolve Node builtins (workerpool requires are indirect; natural sort is in-repo ESM). `@danielsimonjr/mathts-functions/evaluate` is the same safe evaluate as the root and a smaller bundle. Safe evaluate keeps parse, typed, createUnit, resolve, simplify, derivative, and node constructors unreachable. ESM-only migration note, GitHub blob URLs in package READMEs, and a deterministic README stats check.
