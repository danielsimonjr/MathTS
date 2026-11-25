---
'@danielsimonjr/mathts-compat': patch
---

**Unit equality and ordering on the compat instance (#1552):** `equal`, `unequal`, `equalScalar`, `deepEqual`, `compare`, `larger`, `smaller`, `largerEq`, and `smallerEq` route Unit–Unit pairs through activated mathjs factories via `compat/src/unit-relational.ts`, with BigNumber/Fraction mixed-unit guards and mathjs `deepEqual` semantics. `format` on the instance renders integral Fractions as `n/1` for oracle parity (`format-parity.ts`).
