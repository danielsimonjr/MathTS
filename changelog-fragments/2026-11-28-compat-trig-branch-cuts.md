### Fixed

- **Trig branch cuts and BigNumber trig match mathjs 15.3.0 (#1789):** complex.js adapters for `atan`/`acot`, corrected `acsc`/`asec` origins and boolean zero promotion, `atan2` sparse union evaluation, per-instance `BigNumber.precision`, and extended-precision `tan`/`atan` BigNumber paths in compat.
- Synced `functions` `g08-inverse-special-zero` compat oracle for `acsc(0)` with mathjs 15.3.0 (π/2 + i∞).
