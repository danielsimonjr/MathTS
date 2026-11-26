---
'@danielsimonjr/mathts-compat': patch
---

**`schur` / `sylvester` / `lyap` / `solveODE` mathjs 15.3.0 parity in compat only (#1553, #1584).** `create(all)` now runs these four through the adapters in `compat/src/mathjs-parity-g05.ts`: `schur` is the mathjs unshifted QR iteration (oracle diagonal order, subdiagonal residue kept, BigNumber matrices accepted), `sylvester`/`lyap` are the activated factories wired to that `schur`, and `solveODE` ports the mathjs adaptive Runge-Kutta factory (initial step `(tEnd - tStart) / 1`). The native Francis-QR `schur` of `@danielsimonjr/mathts-matrix` and the scipy-style `solveODE` of `@danielsimonjr/mathts-functions` are unchanged. BREAKING (compat): instance `schur` diagonal order and `solveODE` step grid now match mathjs 15.3.0.
