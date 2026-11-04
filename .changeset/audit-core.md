---
'@danielsimonjr/mathts-core': patch
---

`Fraction.multiply` and `divide` cross-reduce before multiplying (Knuth), so the gcds run on the operands instead of the products; `negate`, `abs`, `inverse` and `pow` skip the gcd because their results are already in lowest terms. `Fraction.pow` throws a `TypeError` for a non-integer exponent (it was a bare `RangeError` from `BigInt`). `Unit.createUnit` with several definitions now creates units whose definition names a unit that comes later in the object, and names the unresolved ones when a definition can never resolve. VA/VAR selection compares the real part to the imaginary part instead of to an absolute 1e-14. The unit-lookup memo holds 1000 entries (was 100). Removed a stale TODO in `factory.ts`.
