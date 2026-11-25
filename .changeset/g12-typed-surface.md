---
'@danielsimonjr/mathts-compat': minor
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-expression': minor
'@danielsimonjr/mathts-functions': minor
---

Typed-package surface exports and decisions (#1567–#1571): `core` exports the canonical `DimensionError`/`IndexError` and the lowercase constant aliases (`pi`, `e`, `tau`, `phi`, `i`); `functions` exports `ArgumentsError`, `FibonacciHeap`, `ImmutableDenseMatrix`, `Spa` and the mathjs-named `create*` aliases of its 63 `factory_*` factories; `expression` exports `docs`, a canonical `ResultSet` class, the 16 Node classes and the ready-made `Parser`. The typed elementwise dimension mismatches now throw the canonical `DimensionError` with the same message. Events (`on`/`off`/`once`/`emit`), the `all` bundle, the `expression` namespace and the remaining mathjs factories/dependency bundles stay compat-only, per the decisions in `docs/migration-guide.md`.
