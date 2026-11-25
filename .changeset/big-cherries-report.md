---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

BigNumber Unit equality (#1552): the relational Unit paths compare the SI-normalized unit values with the scalar `equal` semantics instead of `===` (a reference compare) and order them with the value's own `compare` instead of a `number` cast, so `50cm == 0.5m` is `true` under `number: 'BigNumber'`, and `larger`, `smaller`, `largerEq`, `smallerEq` and `compare` order BigNumber units numerically. Different dimensions throw the mathjs `Cannot compare units with different base` across the relational family, and `deepEqual` of two Units matches mathjs 15.3.0 (numeric comparison of the units' string forms). One shared helper serves the typed relational Unit paths; `core` gains the `stringToNumber` conversion export that the `deepEqual` string rows need.
