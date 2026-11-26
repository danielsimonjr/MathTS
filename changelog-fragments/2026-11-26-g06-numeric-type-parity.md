### Fixed

- **Preserve BigNumber/Fraction/Complex types (#1554):** compat `pinv`, `bernoulli`, `unaryPlus`, and `compare` now preserve BigNumber, Fraction, and Complex inputs and honor `config.number` through `evaluate` instead of collapsing to `number`. Compat-only adapters: the native `functions` / `matrix` behavior is unchanged.
