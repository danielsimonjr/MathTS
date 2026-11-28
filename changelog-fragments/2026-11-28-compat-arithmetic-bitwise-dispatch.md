### Fixed

- **Arithmetic and bitwise scalar dispatch matches mathjs 15.3.0 (#1787):** compat now routes factory scalars through mathjs fraction.js, decimal.js operand order, unit magnitude multiply/divide, bigint×unit via `unit.multiply`, nested matrix row lists, `norm` at `p === 0`, fraction `log`, high-precision `log` on BigNumber via decimal.js, and zeta `factorial` on complex indices with zero imaginary part.
