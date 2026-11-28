### Fixed

- **Compat linalg decompositions match mathjs 15.3.0 (#1791):** `qr`, `det`, `eigs`, `expm`, `pinv`, and instance `solveODE` / relational `max(smallerEq)` wired for mathjs dogfood oracles — Bareiss `det`, Householder `qr` with Smith complex division, BigNumber `eigs` via non-enumerable `InstanceBigNumber`, square `expm` errors, `pinv` arity, and `larger`/`smaller` factory binding for `solveODE` maxStep.
