# Parity classification adjudication (#1592–#1713)

Adjudicator: independent verification on `main` (2026-11-25), reconciling worker PR
[#1717](https://github.com/danielsimonjr/MathTS/pull/1717) and challenger PR
[#1718](https://github.com/danielsimonjr/MathTS/pull/1718).

## Summary

| Metric                                                       |                                             Value |
| ------------------------------------------------------------ | ------------------------------------------------: |
| Issues classified                                            |                                               122 |
| Package assignments (agree worker/challenger)                |                                               122 |
| Family assignments adjusted                                  |                                                 9 |
| Final family vocabulary                                      |                                                63 |
| Challenger V1–V18 findings **accepted**                      |                                                14 |
| **Modified** (accepted with doc/scope tweak, no slug change) |                                                 3 |
| **Rejected**                                                 | 1 (V17 as blocking — noted as documentation only) |

## Disputed issues (7 disagree + 2 unsure)

| Issue | Worker                                                     | Adjudication                                                                                                                       |
| ----- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| #1597 | `functions.cas-simplify`                                   | **Accept challenger:** add secondary `functions.cas-transforms` (zTransform in `typed/cas.ts`).                                    |
| #1599 | `functions.interpolation` + 3 secondaries                  | **Accept challenger:** add `functions.numbertheory` (`continuedFraction` in `numbertheory/extra.ts`).                              |
| #1601 | `linalg.matrix-ops` + `linalg.decompositions`              | **Accept challenger:** drop `linalg.decompositions` secondary (bugs only in `functions` matrix-ops/numeric).                       |
| #1606 | `trigonometry.trig-variants` (unsure)                      | **Modify:** keep primary; add secondary `functions.geometry` for haversine rows; fix families.md (haversine not in trigonometry/). |
| #1617 | `functions.polynomials` (unsure)                           | **Resolve unsure:** keep worker order (Polynomial class is power-basis); fix cited source dirs only.                               |
| #1649 | `functions.symbolic-regression` + `functions.optimization` | **Accept challenger:** drop optimization secondary.                                                                                |
| #1693 | `statistics.doe-industrial`                                | **Accept challenger:** add secondary `statistics.regression-models` (P0 fitlm overlaps #1688).                                     |
| #1708 | `tensor.core-operations` + `functions.array-reductions`    | **Accept challenger:** secondary → `tensor.dtypes` only; flag overlap with #1707 in GitHub comment.                                |
| #1713 | `plot.data-helpers` + `units.numeric-adapters`             | **Accept challenger:** secondary → `functions.geometry` (coordinateTransform / mesh rows).                                         |

## Vocabulary findings V1–V18

| ID  | Verdict                   | One-line reasoning                                                                                                                |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| V1  | **Accept**                | `functions/src/typed/poly.ts` absent; verified `polyval`/`polyFit` in `typed/algebra.ts` and `typed/interpolation.ts`.            |
| V2  | **Accept**                | `communityColoring` absent; `graphColoring` exported from `graph/community-coloring.ts`.                                          |
| V3  | **Accept**                | No `envelope` in `functions/src`; marked planned gap under `signal.spectral`.                                                     |
| V4  | **Accept**                | No `hannWindow`/`blackmanWindow`; `windowFunction` + `windows-extra.ts` used as representatives.                                  |
| V5  | **Accept**                | `convmtx`/`xcorr2`/`cconv` absent (planned); `fft2d` lives in `typed/signal.ts`.                                                  |
| V6  | **Accept**                | `magic`/`gallery`/`rosser` planned; `hilbertMatrix` + `isSymmetric` in `linalg-special-matrices.ts` / `matrix/.../common.ts:176`. |
| V7  | **Accept**                | `matrix.dense-operations` unused in proposals and mis-cited det/inv; removed; `matrix.sparse` retained.                           |
| V8  | **Accept**                | Sparse home is `SparseMatrix.ts` + `functions/algebra/sparse`, not `matrix/operations`.                                           |
| V9  | **Accept**                | GP in `functions/src/stats/gaussian-process.ts`, not `ml/gaussian-process.ts`.                                                    |
| V10 | **Accept**                | Extended nodes in `gauss-nodes-extra.ts`; base Legendre in `gauss-nodes.ts`.                                                      |
| V11 | **Accept**                | `reduce` in `typed/algebra.ts` is CAS Reduce; list reps are map/filter/forEach.                                                   |
| V12 | **Modify**                | Haversine in `geometry-extra.ts`; trig family scope corrected; #1606 gets `functions.geometry` secondary.                         |
| V13 | **Accept**                | Split `numbers.precision` → `numbers.intervals`, `numbers.machine-limits`, `numbers.precision-metadata`.                          |
| V14 | **Modify**                | Kept both families; documented shared `fit-scalar.ts` and real homes for `curvefit`/`levenbergMarquardt`.                         |
| V15 | **Modify**                | Clarified non-overlapping scopes in families.md (ufuncs vs selection vs reductions).                                              |
| V16 | **Accept**                | Removed numeric `solveODE` from `functions.cas-ode` representatives.                                                              |
| V17 | **Reject (non-blocking)** | Future `@danielsimonjr/mathts-image` noted in families; issues stay `pkg:functions` until package exists.                         |
| V18 | **Modify**                | Header documents implementation home vs re-export package; no slug re-home of 31 functions families.                              |

## Spot-check of agreed classifications (20 issues)

Verified package + family against source paths on `main`:

#1592, #1593, #1594, #1596, #1598, #1600, #1602, #1603, #1604, #1605, #1608, #1613,
#1618, #1623, #1634, #1659, #1688, #1695, #1706, #1711 — all **confirmed**.

## Medium-confidence worker rows (8)

| Issue | Adjudication                                                                            |
| ----- | --------------------------------------------------------------------------------------- |
| #1595 | **Confirm** `signal.filter-design` primary; spectral + fft secondaries match bug table. |
| #1599 | **Adjusted** (see dispute table).                                                       |
| #1601 | **Adjusted** (see dispute table).                                                       |
| #1617 | **Confirm** primary/secondary order; sources fixed.                                     |
| #1637 | **Confirm** `functions.quadrature` (checked adaptive-quad / finite-differences paths).  |
| #1649 | **Adjusted** (see dispute table).                                                       |
| #1654 | **Confirm** `functions.interpolation` (spline/N-D scope).                               |
| #1690 | **Confirm** `statistics.clustering-distances` (distances + dbscan/kde paths).           |

## Issue-level duplicates (flagged in GitHub comments, not closed)

- **#1707 / #1708:** both own Tensor `astype`, `argmax`, `argsort` rows — coordinate via `tensor.dtypes` + `tensor.core-operations`.
- **#1693 / #1688:** shared P0 `fitlm` / LinearModel row — DOE issue carries `statistics.regression-models` secondary.

## Deliverables

- `families.md` — 63 families, source-grounded
- `classification.json` / `classification.md` — per-issue labels
- GitHub: `pkg:*` + `family:*` labels and one classification comment per issue
- Tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714) body updated by package/family
