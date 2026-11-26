### Added

- **Challenger findings for G05 (#1553, #1584):** `docs/challenger/g05-findings.md`
  records four defects in the G05 compat adapters (`compat/src/mathjs-parity-g05.ts`)
  against the mathjs 15.3.0 oracle — BigNumber `schur` stops one QR iterate early
  (a stopping-rule difference of 1.2e-8, not a decimal-precision one), native
  `DenseMatrix` input takes the native Francis-QR path, BigNumber
  `sylvester`/`lyap` for 3x3+ inherit the early stop, and a Complex `schur`
  diagonal residue — pinned by the falsifying
  `compat/tests/parity/challenger-g05.test.ts`.
