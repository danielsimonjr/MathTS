---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

Non-finite inputs (NaN, +Infinity, -Infinity) no longer hang or give a wrong number.

- `gcd`, `lcm` and `xgcd` return `NaN` (`xgcd`: `[NaN, NaN, NaN]`) for a NaN or infinite argument. Before, they looped forever.
- `nextPrime` throws a `RangeError` for a non-finite argument or an argument at or above `Number.MAX_SAFE_INTEGER`. Before, `nextPrime(Infinity)` looped forever and `nextPrime(NaN)` returned `NaN`.
- `isPrime(Infinity)` returns `false`. Before, it looped forever. `isPrime(NaN)` returns `false` (was `true`).
- `range` throws a `RangeError` when an infinite start or end gives an unbounded range. Before, it looped until memory ran out.
- `quad` returns `{ value: NaN, error: NaN }` when a panel error is NaN, so `owensT` with a NaN or missing argument returns `NaN` at once. Before, it bisected to depth 50.
- `shortestPath` throws a `TypeError` when `adj` is not an array and a `RangeError` when `start` or `end` is not an integer. Before, a non-integer `end` looped forever.
- `erfc(NaN)` (JS and the AssemblyScript kernel), `normalCDF` with a NaN in any position, `primePi(NaN)`, the three-argument median and `zeta(NaN)` return `NaN`. Before, they returned 2, 1, 0, a sorted element and 1.
- Behaviour change: the typed `compare(NaN, x)` and `compare(x, NaN)` return `-1`, the same as mathjs and the factory `compare`. Before, they returned `0`. No function in the package calls the typed `compare`; `sort` and `partitionSelect` use the factory `compare`, which already returned `-1`.

Finite inputs give the same results as before.
