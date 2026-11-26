### Fixed

- **Preserve BigNumber/Fraction/Complex types (#1554):** compat `pinv`, `bernoulli`, `unaryPlus`, and `compare` now preserve BigNumber, Fraction, and Complex inputs and honor `config.number` through `evaluate` instead of collapsing to `number`. Compat-only adapters: Bernoulli uses the full mathjs recurrence (including `0`/`1`/odd indexes and float overflow); `compare` rejects mixed BigNumber/Fraction pairs; number-only matrix `pinv` follows the mathjs factory path (singular `pinv([[0,1]])` throws). Native `functions` / `matrix` behavior is unchanged.
