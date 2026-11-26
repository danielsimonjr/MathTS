### Changed

- **Compat matches mathjs on `zeta`, `symbolicEqual`, and `range` (#1585):** `create(all)` uses mathjs 15.3.0 adapters in `compat/src/mathjs-parity-1585.ts` (mathjs zeta quirks, simplify-only `symbolicEqual`, BigNumber `range` string/`includeEnd` behavior). Native `@danielsimonjr/mathts-functions` stays more accurate; `docs/api/compat.md` documents the split. Parity is pinned in `compat/tests/parity/g18-parity.test.ts` and `compat/tests/parity/adversarial-g18.test.ts`; the pool sweep probes unary `zeta`.

### Fixed

- **`gamma` / `lgamma` / `factorial` of a bigint followed the BigNumber path:** same missing-`bigint` signature as `zeta`. Typed-function conversion prefers `bigint → BigNumber` when both `number` and `BigNumber` rows exist, so `gamma(2n)` was a `BigNumber` while `gamma(2)` was a number. Each now calls its number implementation through `bigintToNumber` (out-of-range bigints throw). `erf` already had no BigNumber row and already returned a number.

- **`zeta(bigint)` returned a BigNumber in default number config (#1585):** with no `bigint` signature, typed-function conversion sent safe integers to the BigNumber path, so `zeta(2n)` was a `BigNumber` while `zeta(2)` was a number. Root cause: missing `bigint` dispatch. `functions/src/special/zeta.ts` now calls `zetaNumber(bigintToNumber(s))`; out-of-range bigints throw as elsewhere.
