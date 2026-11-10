---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-wasm': patch
---

Non-finite inputs (NaN, +Infinity, -Infinity) no longer hang or give a wrong number.

Behaviour changes (the reason for the minor bump):

- The typed `compare(NaN, x)` and `compare(x, NaN)` return `-1`, the same as mathjs and the factory `compare`. Before, they returned `0`. No function in the package calls the typed `compare`; `sort` and `partitionSelect` use the factory `compare`, which already returned `-1`.
- New throws:
  - `nextPrime(n)` throws a `RangeError` when `n` is not finite or `n >= Number.MAX_SAFE_INTEGER`. Before, `nextPrime(Infinity)` looped forever, `nextPrime(NaN)` returned `NaN`, and a finite `n` at or above the safe-integer limit gave an inexact result.
  - `range` throws a `RangeError` when an infinite start or end gives an unbounded range. Before, it looped until memory ran out.
  - `shortestPath` throws a `TypeError` when `adj` is not an array, and a `RangeError` when `start` or `end` is not an integer. This changes one finite input: `shortestPath(adj, 0.5, 1)` returned `[]` and now throws. Before, a non-integer `end` looped forever.
  - `quad` (and `nintegrate` and `arcLength`, which call it) throws a `RangeError` for a NaN or infinite bound. Before, an infinite bound bisected to depth 50 and did not end in practice.
  - `owensT` throws a `TypeError` when an argument is missing.

Fixes:

- `gcd`, `lcm` and `xgcd` return `NaN` (`xgcd`: `[NaN, NaN, NaN]`) for a NaN or infinite argument in either position. Before, they looped forever.
- `isPrime(Infinity)` returns `false`; before, it looped forever. `isPrime(NaN)` returns `false` (was `true`).
- `owensT(h, Infinity)` returns `(1 - Phi(|h|)) / 2`, and `owensT(h, -Infinity)` the negative value. Before, both did not end. `owensT` with a NaN argument returns `NaN`.
- `ferrersP` with an infinite degree or order, `siegelZ` / `riemannSiegelZ` at +-Infinity, and `trigamma` / `polygamma` at -Infinity return `NaN`. Before, they looped forever.
- `acoth`, `asech`, `acsc` and `asec` give the complex result off their real domain (for example `acoth(0.5)`). Before, they threw `TypeError: ... is not a function`, because the core Complex type has no such methods.
- `erfc(NaN)` (JS and the AssemblyScript kernel), `normalCDF` with a NaN in any position, `primePi(NaN)`, the three-argument median and `zeta(NaN)` return `NaN`. Before, they returned 2, 1, 0, a sorted element and 1.

Other finite inputs give the same results as before.
