# Challenge report: #1592-#1713 classification (tracker #1714)

Independent challenge of the worker's draft
([PR #1717](https://github.com/danielsimonjr/MathTS/pull/1717), branch
`cursor/parity-classification-820e`): `families.md` (62 families),
`proposals.json` (122 entries) and `proposals.md`.

Verdict per issue lives in `challenge.json` (122 entries, one per issue).
Nothing here was applied to the issues themselves — no labels, comments or edits,
and the worker's branch was not touched.

## Method

1. **Structural check of `proposals.json`.** Parsed all 122 entries; compared the
   issue set to `range(1592, 1714)`; cross-checked every `family` and
   `secondary_families` slug against the 62 slugs parsed out of `families.md`;
   compared each proposed package to the issue's own `pkg:*` GitHub label and
   each `type` to its `type:*` label.
2. **Vocabulary check against the tree.** Extracted all 119 `pkg/src/...` path
   tokens and all 147 `.ts` filenames from `families.md` and resolved each with
   `ls`/glob. Then checked each representative function name for a real
   `export` (`rg`), plus targeted greps for the ones that looked invented.
3. **Independent per-issue re-read.** `gh issue view <n> --json` for all 122
   issues, reading the package line, the batch/type/priority line, the
   scope/root-cause summary and the per-function table, then locating the
   nearest real implementation for each row.

## Counts

|                               | agree   | disagree | unsure |
| ----------------------------- | ------- | -------- | ------ |
| **Overall verdict**           | **113** | **7**    | **2**  |
| Package                       | 122     | 0        | 0      |
| Family (primary or secondary) | 113     | 7        | 2      |

- **Package: 122/122 agree.** Every proposed package matches the issue's own
  `pkg:*` label, and every label is defensible against where the code lives. The
  worker did not get a single package wrong. (For the thin re-export packages —
  `statistics`, `signal`, `linalg`, `units`, `numbers`, `arithmetic`,
  `trigonometry` — the label names the import surface, not the implementation
  home, which is consistent throughout.)
- **Family: 113 agree, 7 disagree, 2 unsure.** All seven disagreements are about
  _secondary_ families or an unsupported secondary, never about a primary family
  being wholly wrong (with the partial exception of #1713, where the primary is
  defensible only on one row).

`proposals.json` is **structurally sound**: 122 entries, #1592-#1713 with no
duplicates and no gaps, zero unknown slugs, zero package-label mismatches, zero
type-label mismatches. The worker's defects are semantic, in `families.md` and in
a handful of secondary-family calls — not in the bookkeeping.

## Every disagreement

| Issue     | Worker                                                                     | Challenge                                                                 | Evidence                                                                                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1597** | `functions.cas-simplify`, no secondary                                     | add secondary `functions.cas-transforms`                                  | BUG-31 is `zTransform`, a placeholder in `functions/src/typed/cas.ts`; the worker's own rationale calls it "the transforms family" but records no secondary.                                                                                        |
| **#1599** | `functions.interpolation` + `array-sorting`, `polynomials`, `optimization` | add secondary `functions.numbertheory`                                    | BUG-40 `continuedFraction` is `functions/src/numbertheory/extra.ts`; none of the three secondaries cover it.                                                                                                                                        |
| **#1601** | `linalg.matrix-ops` + `linalg.decompositions`                              | drop the `linalg.decompositions` secondary                                | All five bugs are outside `matrix/src`: `typed/matrix-ops.ts` (jordanForm, matrixRank), `numeric/matrix-functions.ts:346` (funm), `numeric/eigsh.ts`, `numeric/structured-solvers.ts` (solveBanded). No `matrix/src/operations` code is implicated. |
| **#1649** | `functions.symbolic-regression` + `functions.optimization`                 | drop the `functions.optimization` secondary                               | The 7 rows are autodiff backend, CSV/checkpoint, `parallelism`, `multiprocessing`, `multithreading`, `precision`, `procs` — search-loop throughput in `scalar-compile.ts` / `scalar-search.ts`. No optimizer routine appears.                       |
| **#1693** | `statistics.doe-industrial`, no secondary                                  | add secondary `statistics.regression-models`                              | Row 1 (the only P0) is `fitlm` — precisely #1688's subject. Homes: `functions/src/ml/ols.ts`, `functions/src/regression-extra.ts`.                                                                                                                  |
| **#1708** | `tensor.core-operations` + `functions.array-reductions`                    | drop the `functions.array-reductions` secondary (better: `tensor.dtypes`) | Rows are Tensor _methods_ (`ndarray.all/any/argmax/argsort/clip/astype`) and einsum strings in `tensor/src/`. `functions.array-reductions` is `functions/src/statistics/*`, untouched here.                                                         |
| **#1713** | `plot.data-helpers` + `units.numeric-adapters`                             | replace secondary with `functions.geometry`                               | Rows 2-9 are mesh generators and coordinate converters; the only in-tree implementation is `coordinateTransform` at `functions/src/typed/geometry.ts:565`. Neither mesh nor coordinate conversion is unit handling.                                 |

### Unsure (2)

| Issue     | Worker                                                             | Why unsure                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1617** | `functions.polynomials` + `functions.orthogonal-polynomials` (med) | The six convenience classes include four orthogonal series, so `orthogonal-polynomials` as _primary_ with `polynomials` secondary is equally defensible. The base `Polynomial` is power-basis, so the worker's order is not wrong — but it cites `functions/src/typed/poly.ts`, which does not exist. |
| **#1606** | `trigonometry.trig-variants` (high)                                | 35 of 41 rows are genuine degree/pi-scaled trig variants, so the primary is right. But the scope's `haversine` rows live in `functions/src/geometry-extra.ts`, so a `functions.geometry` secondary would be more accurate.                                                                            |

## Family-vocabulary problems

The 62-slug vocabulary is the weakest part of the worker's output. **Six families
name source that does not exist** (a file, or the function itself), and **five more
name the wrong home**. 18 findings, V1-V18, fully detailed in
`challenge.json` → `familyVocabularyProblems`.

### Invented or nonexistent source (6)

| #   | Family                     | Problem                                                                                                                                                                                                    |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | `functions.polynomials`    | `functions/src/typed/poly.ts` does not exist. Real homes: `typed/algebra.ts:218` (polyval), `typed/interpolation.ts:506` (polyFit), `algebra/polynomialRoot.ts`, `wasm/poly/`.                             |
| V2  | `functions.graphs`         | Representative `communityColoring` does not exist; the file exports `graphColoring`, `maxClique`, `louvainCommunities`, `katzCentrality`, `isIsomorphic`.                                                  |
| V3  | `signal.spectral`          | Representative `envelope` — zero occurrences in `functions/src`. It is a _gap_ the issues ask for.                                                                                                         |
| V4  | `signal.windows-waveforms` | `hannWindow` / `blackmanWindow` do not exist; real exports are `kaiserWindow`, `gaussianWindow`, `tukeyWindow`, … plus a name-keyed constructor.                                                           |
| V5  | `signal.fft`               | `convmtx`, `xcorr2`, `cconv` have no definition — they are #1695 gap rows. Also attributes `fft2d` to `signal/fft.ts` when it is `typed/signal.ts`.                                                        |
| V6  | `linalg.special-matrices`  | `magic`, `gallery`, `rosser` do not exist (they are #1705 gaps); `hilbert` is `hilbertMatrix`; the structure predicates are `isSymmetric` in `matrix/src/operations/common.ts:176`, not either cited file. |

### Wrong directory

| #   | Family                             | Problem                                                                                                                                                                                                                                  |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V7  | `matrix.dense-operations`          | Claims det/inv in `matrix/src/operations`; that directory has no `det.ts`/`inv.ts`. They are factories in `functions/src/matrix/`. Also **unused by every proposal** — the only family covering the `matrix` package is dead vocabulary. |
| V8  | `matrix.sparse`                    | Claims "sparse support in operations/"; no sparse file there. `SparseMatrix` is `matrix/src/types/SparseMatrix.ts`; the CSparse port is `functions/src/algebra/sparse/`.                                                                 |
| V9  | `statistics.regression-models`     | Names `functions/src/ml/gaussian-process.ts`, which does not exist; the GP code is `functions/src/stats/gaussian-process.ts`.                                                                                                            |
| V10 | `functions.orthogonal-polynomials` | Names `numeric/gauss-nodes.ts`, which exports only `rootsLegendre`. The real nodes are `gauss-nodes-extra.ts`; `chebyshevT`/`hermiteH`/`laguerreL` are in `typed/special.ts`.                                                            |
| V11 | `functions.list-functional`        | Representative `reduce` resolves to the CAS `reduce(expr: string)` at `typed/algebra.ts:1729`, not a list fold.                                                                                                                          |

### Too coarse / overlapping

| #   | Family                                                            | Problem                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V12 | `trigonometry.trig-variants`                                      | Claims haversine (really `geometry-extra.ts`) and cart2pol/cart2sph (really `coordinateTransform` in `typed/geometry.ts`).                                                                                                   |
| V13 | `numbers.precision`                                               | **Too coarse**: one family for per-number precision tracking, interval arithmetic (`numeric/interval.ts`) and machine-constant queries — 29 rows, no shared implementation surface.                                          |
| V14 | `curve-fitting` / `symbolic-regression`                           | **Overlap**: both list `functions/src/fit-scalar.ts` as a source dir. `curve-fitting`'s own representatives (`curvefit`, `levenbergMarquardt`) are in files it does not list.                                                |
| V15 | `arithmetic.elementwise` / `array-selection` / `array-reductions` | **Overlap**: three families on one ufunc surface; the issue rows overlap too (`where`/`select`/`nonzero` in #1608 and #1612; `all`/`any` in #1608, #1609, #1708; `isinf` in #1607, #1608, #1707).                            |
| V16 | `functions.cas-ode`                                               | Lists `solveODE`, which belongs to `functions.ode` — the representative points at the wrong family.                                                                                                                          |
| V17 | `finance` / `image`                                               | Correctly marked proposed, but #1671-#1675 propose a new `@danielsimonjr/mathts-image` package; the `functions`-scoped vocabulary cannot express that.                                                                       |
| V18 | header                                                            | **Inconsistent granularity**: the eight thin re-export packages each get their own package rows, while CAS (~7 families), geometry, graphs, control, PDE, image and finance all sit under one `functions` row (31 families). |

## Secondary observation: issue-content overlaps

The challenge also surfaced overlaps _in the issues themselves_, which no
classifier can resolve — the adjudicator may want to dedupe at the issue level:

- #1707 and #1708 both list `astype`, `argmax`, `argsort`.
- #1693's P0 `fitlm` row duplicates #1688's whole subject.
- #1608 / #1609 / #1612 share `where`/`select`/`nonzero`/`all`/`any`/`clip`.
- #1607 / #1707 both want `eps`/`finfo`-style machine constants from opposite
  packages (`numbers` vs `tensor`).

## Recommendation

The worker's package column can be accepted as-is (122/122). Before the family
column is used for routing, `families.md` needs the V1-V11 source corrections
(six inventions, five wrong directories) and the V13/V14/V15 splits; the seven
secondary-family disagreements above should be applied, since each one either
drops an unsupported secondary or adds a family that owns a bug the issue
actually contains.
