# Future features and six-system parity roadmap

> **For agentic workers:** This is the execution plan for every open MathTS issue that is not the mathjs 15.3.0 compat full-suite. The compat suite is a prerequisite milestone and is not re-planned here. Docs only. Implementation PRs come later, one wave batch at a time.

**Snapshot:** `gh issue list -R danielsimonjr/MathTS --state open --limit 500 --json number,title,labels,body` on 2026-11-26. **145 open issues.** Head of `main` at plan time: `c5c16f935869b28318de047220bd5574037969c9`.

**Prerequisite (do not implement from this file):** [`docs/superpowers/plans/2026-11-26-mathjs-full-suite-plan.md`](2026-11-26-mathjs-full-suite-plan.md) (PR #1795) owns the `@danielsimonjr/mathts-compat` release against mathjs `v15.3.0`.

## Executive summary

After the compat release, MathTS does two cleanup PRs, then builds the six-system parity program filed as #1592–#1714 (NumPy 2.5.5, SciPy 1.18.1, PySR 2.7.3, Mathematica, PTC Mathcad Prime, MATLAB). Those 123 issues are the tracker #1714 plus 122 children. Priorities on the 122 children, taken from labels: **P0 64, P1 24, P2 34**. #1714 itself has no priority label.

Package labels on the 123: `pkg:functions` 72, `pkg:statistics` 21, `pkg:signal` 10, `pkg:units` 5, `pkg:linalg` 4, `pkg:tensor` 3, and one each of `pkg:arithmetic`, `pkg:trigonometry`, `pkg:numbers`, `pkg:matrix`, `pkg:expression`, `pkg:compat`, `pkg:plot`. #1714 has no package label. Re-export packages (`statistics`, `signal`, `linalg`, `arithmetic`, `trigonometry`, `numbers`, `units`) do not hold implementations; the plan names the real directory.

No open issue is labeled `pkg:gpu`, `pkg:parallel`, `pkg:typed-function`, or workerpool. Phase 4 says so, and it still names those trees because #1649 (symbolic-regression throughput) is the only open performance issue and may measure them. Native packages stay free of `mathjs` filenames (#1800) and of mathjs-only quirks (#1712 lives in `compat/`).

## Open-issue coverage

| Bucket                                                                                       | Issues             |   Count |
| -------------------------------------------------------------------------------------------- | ------------------ | ------: |
| Prerequisite compat full-suite (planned in `2026-11-26-mathjs-full-suite-plan.md`, not here) | #1773, #1776–#1794 |      20 |
| Phase 0 post-compat-release refactor                                                         | #1800, #1799       |       2 |
| Phases 1–4 parity and future features                                                        | #1592–#1714        |     123 |
| **Open issues**                                                                              |                    | **145** |

Closed issues that the compat plan still mentions (#1774, #1775) are not in this open set and are not counted.

Zero omitted, zero duplicated: the three buckets partition the live list. The union is exactly the 145 numbers below.

### Prerequisite — compat full-suite (20)

Accounted here so the total matches GitHub. Implementation steps stay in the full-suite plan. Owning package: `@danielsimonjr/mathts-compat`. These issues had **no labels** at snapshot time.

| Issue | Priority | Package | References | Title                                                                                       |
| ----: | -------- | ------- | ---------- | ------------------------------------------------------------------------------------------- |
| #1773 | —        | —       | —          | [parity][compat] Error classes and messages do not match mathjs 15.3.0                      |
| #1776 | —        | —       | —          | [parity][compat] help() cannot find mathjs embedded documentation                           |
| #1777 | —        | —       | —          | [parity][compat] Sandbox reports undefined symbol instead of blocked property access        |
| #1778 | —        | —       | —          | [parity][compat] format() and print() ignore mathjs precision and syntax                    |
| #1779 | —        | —       | —          | [parity][compat] Fraction toString/valueOf do not match mathjs 15.3.0                       |
| #1780 | —        | —       | —          | [parity][compat] BigNumber class identity and valueOf differ from mathjs 15.3.0             |
| #1781 | —        | —       | —          | [parity][compat] Complex valueOf and format differ from mathjs 15.3.0                       |
| #1782 | —        | —       | —          | [parity][compat] JSON replacer/reviver does not round-trip mathjs values                    |
| #1783 | —        | —       | —          | [parity][compat] Chain does not clear inherited properties                                  |
| #1784 | —        | —       | —          | [parity][compat] Unit conversion, createUnit, and unit predicates differ from mathjs 15.3.0 |
| #1785 | —        | —       | —          | [parity][compat] DenseMatrix and SparseMatrix do not match the mathjs matrix model          |
| #1786 | —        | —       | —          | [parity][compat] Parser, evaluate, and AST nodes differ from mathjs 15.3.0                  |
| #1787 | —        | —       | —          | [parity][compat] Arithmetic and bitwise dispatch rejects inputs mathjs accepts              |
| #1788 | —        | —       | —          | [parity][compat] Relational compares and statistics differ from mathjs 15.3.0               |
| #1789 | —        | —       | —          | [parity][compat] Trig branch cuts return the wrong Complex value                            |
| #1790 | —        | —       | —          | [parity][compat] simplify, derivative, and resolve emit different strings                   |
| #1791 | —        | —       | —          | [parity][compat] qr, eigs, det, inv, and pinv disagree with mathjs 15.3.0                   |
| #1792 | —        | —       | —          | [parity][compat] distance and intersect disagree with mathjs 15.3.0                         |
| #1793 | —        | —       | —          | [parity][compat] Set functions disagree with mathjs 15.3.0                                  |
| #1794 | —        | —       | —          | [parity][compat] rationalize does not finish the mathjs complex-expression case             |

### Every open issue number

```
#1592 #1593 #1594 #1595 #1596 #1597 #1598 #1599 #1600 #1601 #1602 #1603 #1604 #1605 #1606 #1607 #1608 #1609 #1610 #1611 #1612 #1613 #1614 #1615 #1616 #1617 #1618 #1619 #1620 #1621 #1622 #1623 #1624 #1625 #1626 #1627 #1628 #1629 #1630 #1631 #1632 #1633 #1634 #1635 #1636 #1637 #1638 #1639 #1640 #1641 #1642 #1643 #1644 #1645 #1646 #1647 #1648 #1649 #1650 #1651 #1652 #1653 #1654 #1655 #1656 #1657 #1658 #1659 #1660 #1661 #1662 #1663 #1664 #1665 #1666 #1667 #1668 #1669 #1670 #1671 #1672 #1673 #1674 #1675 #1676 #1677 #1678 #1679 #1680 #1681 #1682 #1683 #1684 #1685 #1686 #1687 #1688 #1689 #1690 #1691 #1692 #1693 #1694 #1695 #1696 #1697 #1698 #1699 #1700 #1701 #1702 #1703 #1704 #1705 #1706 #1707 #1708 #1709 #1710 #1711 #1712 #1713 #1714 #1773 #1776 #1777 #1778 #1779 #1780 #1781 #1782 #1783 #1784 #1785 #1786 #1787 #1788 #1789 #1790 #1791 #1792 #1793 #1794 #1799 #1800
```

## Sequencing

```
Prerequisite  #1773, #1776–#1794   compat release  (other plan)
      |
      v
Phase 0       #1799 then #1800     core errors, then filename sweep
      |
      v
Phase 1       foundations          1A numbers/arithmetic/trig
                                   1B unit registry
                                   1C sparse matrix + tensor
                                   1D array language
      |
      +------------------+---------------------------+
      v                  v                           v
Phase 2 numeric     Phase 3 symbolic            (Phase 2 and 3
  bugs, specials,     CAS, expression,           may overlap after
  quadrature, ODE,    symbolic regression        Phase 0 if their
  linalg, signal,     except throughput          files stay disjoint)
  statistics, geometry
      |                  |
      +--------+---------+
               v
Phase 4        #1649 throughput (after 3D)
               #1712 compat flags (after #1604 and #1694)
               #1713 plot helpers (after #1655)
               #1714 close the tracker last
```

Phase 2 does not block on all of Phase 1. A wave starts when its own dependencies in the tables below are merged. Phase 0 blocks every wave that adds files, so new files are born with MathTS names.

Hard dependencies copied from issue text:

- #1800 includes #1799 and waits on the compat release.
- #1676 after #1592; #1677–#1681 after #1676; #1686 after #1593; #1687 after the distribution parts it fits.
- #1712 depends on #1604 and #1694.
- #1638/#1639 wrap numeric routines from Phase 2D and the registry from #1709.
- #1649 after the functional symbolic-regression issues, not before.
- #1708 after #1707. #1703 after #1601.

## Rules for every implementation PR

- One issue, one PR, unless a wave table says two issues share a file and must be sequential in a single branch. `Fixes #N` in the PR body.
- Native behavior follows NumPy/SciPy/SymPy. MATLAB, Mathcad, and Mathematica conventions that disagree go to `compat/` (#1712), not into `core`, `matrix`, `functions`, `packages/typed-function`, `packages/workerpool`, `gpu`, or `parallel`.
- No new runtime dependency. No `mathjs` import in `src/`. No `: any`, `as any`, `as never`, or `@ts-ignore`.
- Root-cause the reported failure (`rfl`) and add a regression that fails before the fix. Oracles are the reference system named on the issue, not a round-trip through the same code.
- Changelog fragment: `changelog-fragments/YYYY-MM-DD-<slug>.md`. Do not hand-edit `CHANGELOG.md`.
- Re-export packages (`arithmetic/`, `trigonometry/`, `numbers/`, `units/`, `linalg/`, `statistics/`, `signal/`) get an export line only. The code goes in the package that already implements that domain.
- Shared barrels (`functions/src/index.ts`, `functions/src/factories/index.ts`, `core/src/index.ts`, `matrix/src/index.ts`, `compat/src/function-reexports.ts`, `compat/src/named-instance-exports.ts`) take a one-line sorted insertion. Two PRs in review do not edit the same barrel.
- Expression property access stays on `getSafeProperty` / `setSafeProperty` / `getSafeMethod`. WASM still goes through SHA-384 verification. `WorkerPool` timeout plumbing stays.
- Acceleration is measured per kernel. `functions/src/wasm/policy.ts` and `gpu/src/flag.ts` already encode the losses. A new kernel does not join WASM or GPU because the tier exists.

## Super-Team execution

`grok-4.7` writes the plan. `gemini-4-neon` reviews and fixes the plan. `composer-2.5` builds the implementation PR. `grok-4.6` challenges it. `gemini-4-neon` reviews and fixes the PR directly. Squash-merge on green. Keep the branch. Docs-only PRs skip heavy CI wait.

## Phases and waves

### Wave 0.1 — Error hierarchy (#1799)

Issues in this wave: 1.

| Issue | Priority | Package | References | Title                                                                                                          |
| ----: | -------- | ------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| #1799 | —        | —       | —          | core: unified errors and messages framework (rename MathjsError, centralize error classes and message catalog) |

**Touchpoints (on `main`):**

- `core/src/error/MathjsError.ts`, `core/src/error/DimensionError.ts`, `core/src/error/IndexError.ts` (today the whole `core/src/error/` directory).
- `core/src/types/unit/errors.ts` (`UnitParseError`, `DimensionMismatchError`, `AmbiguousUnitError`).
- `core/src/square-error.ts`, `core/src/index.ts` (public re-exports).
- Call sites that construct these classes stay behavior-preserving until a later issue opts into the catalog. `compat/` keeps mathjs class names as aliases; do not rename compat files to drop `mathjs`.

**Shared-file conflicts:**

`core/src/error/index.ts` and `core/src/index.ts` are single-writer for this wave. No other Phase 0 PR edits `core/src/error/` while #1799 is open.

**Verification:**

Unit tests for each class (code, message, `cause`). Snapshot the formatted catalog in `messages.ts`. `compat` mathjs error strings stay owned by the prerequisite plan, not this issue. No `any`, `as never`, or `@ts-ignore`. No new runtime dependency.

**Exit:**

`MathjsError.ts` is gone from `core/src/error/`. Every core error class lives under `core/src/error/` with a MathTS name. `messages.ts` is the only catalog. `rg -l MathjsError core/src` is empty except a temporary deprecated alias if compat still needs the old export name, and that alias is not a filename.

### Wave 0.2 — Filename audit (#1800)

Issues in this wave: 1.

| Issue | Priority | Package | References | Title                                                                              |
| ----: | -------- | ------- | ---------- | ---------------------------------------------------------------------------------- |
| #1800 | —        | —       | —          | refactor: post-compat-release sprint to remove mathjs naming from non-compat files |

**Touchpoints (on `main`):**

- Repo-wide filename audit outside `compat/` and outside changelog history. Known filename today: `core/src/error/MathjsError.ts` (removed by #1799).
- Identifier sweep in `core/src/`, `matrix/src/`, `functions/src/`, `expression/src/`, `packages/typed-function/`, `packages/workerpool/`, `gpu/src/`, `parallel/src/`, `tensor/src/`. Comments that only mention the compat layer may stay.
- `compat/src/**` is out of scope except import updates required to follow a renamed native export.

**Shared-file conflicts:**

Depends on #1799. One PR. Do not run it in parallel with any PR that renames the same files.

**Verification:**

`find` for filenames matching `*[Mm]athjs*` outside `compat/`, `changelog-fragments/`, `CHANGELOG.md`, and `docs/` returns empty. Native and compat test suites stay green. Changelog fragment records the rename.

**Exit:**

#1799 is merged. Acceptance checklist in #1800 is checked. Native packages do not carry `mathjs` filenames.

### Wave 1A — Numeric primitives

Issues in this wave: 3.

| Issue | Priority | Package          | References                                          | Title                                                                                                     |
| ----: | -------- | ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| #1607 | P0       | pkg:numbers      | ref:mathematica, ref:matlab                         | [parity][numbers] Numeric precision and machine-number utilities (NUMBERS-1)                              |
| #1605 | P0       | pkg:arithmetic   | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy | [parity][arithmetic] Elementwise math completion (NumPy ufuncs, MATLAB/Mathcad elementary math) (ARITH-1) |
| #1606 | P1       | pkg:trigonometry | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy | [parity][trigonometry] Degree-based and pi-scaled trigonometry (TRIG-1)                                   |

**Touchpoints (on `main`):**

- `#1607` `pkg:numbers` is a re-export (`numbers/src/index.ts`). Implementation lives in `core/src/types/complex.ts`, `core/src/types/fraction.ts`, `core/src/types/bignumber.ts`, `core/src/number.ts`.
- `#1605` `pkg:arithmetic` re-exports `functions`. Implementations: `functions/src/arithmetic/`, `functions/src/plain/number/`.
- `#1606` `pkg:trigonometry` re-exports `functions`. Implementations: `functions/src/` trig modules consumed by `trigonometry/src/index.ts`.

**Shared-file conflicts:**

Three packages, three barrels: `numbers/src/index.ts`, and the arithmetic vs trigonometry regions of `functions/src/index.ts`. Split the functions barrel edits by sorted export lines; do not also edit `functions/src/factories/index.ts` in the same hunk as an unrelated factory. #1605 and #1606 can run together only if they touch disjoint source files.

**Verification:**

Oracle: NumPy ufuncs for #1605, MATLAB/Mathcad degree and pi-scaled trig for #1606, machine epsilon / precision metadata against IEEE-754 and Mathematica `MachinePrecision` behavior for #1607. Root-cause the failing case (`rfl`) before widening the API.

**Exit:**

Each issue's exported names exist on the owning package barrel and match the oracle cases recorded in the issue.

### Wave 1B — Unit registry

Issues in this wave: 2.

| Issue | Priority | Package   | References                                          | Title                                                                                         |
| ----: | -------- | --------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| #1709 | P0       | pkg:units | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy | [parity][units] Unit systems, registry breadth and physical constants (part 1/2) (UNITS-3-p1) |
| #1710 | P2       | pkg:units | ref:mathematica, ref:scipy                          | [parity][units] Unit systems, registry breadth and physical constants (part 2/2) (UNITS-3-p2) |

**Touchpoints (on `main`):**

- Units implementation is `core/src/types/unit/` (`Unit.ts`, `unit-table.ts`, `unit-types.ts`, `errors.ts`). `units/src/index.ts` only re-exports.
- #1710 is the long tail and starts after #1709's registry shape is stable.

**Shared-file conflicts:**

Both edit `core/src/types/unit/unit-table.ts`. Serialize #1709 then #1710. Do not co-mingle with Phase 0 edits to `errors.ts` (land Phase 0 first).

**Verification:**

Pint/SciPy `physical_constants` and Mathcad/MATLAB unit-name tables for the rows in the issue. Round-trip `to`/`toSI` on every unit added.

**Exit:**

#1709 merged before #1710 starts. New units resolve through `core/src/types/unit/` only.

### Wave 1C — Matrix and tensor foundations

Issues in this wave: 4.

| Issue | Priority | Package    | References                 | Title                                                                                        |
| ----: | -------- | ---------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| #1706 | P0       | pkg:matrix | ref:matlab, ref:scipy      | [parity][matrix] Sparse matrices: constructors, formats and sparse linear algebra (MATRIX-1) |
| #1602 | P1       | pkg:tensor | ref:numpy                  | [parity][tensor] Tensor pad: unknown modes silently fall through to reflect (TENSOR-BUG)     |
| #1707 | P0       | pkg:tensor | ref:matlab, ref:numpy      | [parity][tensor] Tensor dtypes (follow-up to #760) (TENSOR-1)                                |
| #1708 | P0       | pkg:tensor | ref:mathematica, ref:numpy | [parity][tensor] ndarray-style Tensor methods, einsum strings and tensor algebra (TENSOR-2)  |

**Touchpoints (on `main`):**

- `#1706` `matrix/src/types/SparseMatrix.ts` plus `matrix/src/operations/` (sparse algebra stays in `@danielsimonjr/mathts-matrix`, not a mathjs-shaped clone). `linalg/src/index.ts` only re-exports.
- `#1602` tensor pad: `tensor/src/Tensor.ts` and `tensor/src/operations/`.
- `#1707` dtypes, then `#1708` ndarray methods / einsum: same `tensor/src/Tensor.ts`, `tensor/src/named-index.ts`, `tensor/src/contraction-sequence.ts`.

**Shared-file conflicts:**

#1707 and #1708 both own `tensor/src/Tensor.ts`: strict order #1707 → #1708. #1602 lands before #1708 if it edits `Tensor.ts`; it may run beside #1706 (different packages). #1706 does not edit `functions/src/index.ts`.

**Verification:**

SciPy.sparse / MATLAB sparse for #1706. NumPy `pad` modes for #1602 (unknown mode must throw, not silently reflect). NumPy dtype and `einsum` for #1707/#1708.

**Exit:**

#1602 no longer maps unknown modes to reflect. #1707 dtype tags exist before #1708 method work merges. Sparse constructors and solvers called out in #1706 pass their oracle.

### Wave 1D — Array language on functions

Issues in this wave: 7.

| Issue | Priority | Package       | References                                          | Title                                                                                      |
| ----: | -------- | ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| #1604 | P0       | pkg:functions | ref:mathcad, ref:matlab, ref:numpy                  | [parity][functions] Array creation and grids (FN-ARR-1)                                    |
| #1608 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy | [parity][functions] Elementwise selection, predicates and comparisons (FN-ARR-2)           |
| #1609 | P0       | pkg:functions | ref:matlab, ref:numpy                               | [parity][functions] Reductions: boolean, arg, nan-aware, keepdims/axis (FN-ARR-3)          |
| #1610 | P0       | pkg:functions | ref:mathcad, ref:matlab, ref:numpy                  | [parity][functions] Sorting, searching and set operations (FN-ARR-4)                       |
| #1611 | P0       | pkg:functions | ref:matlab, ref:numpy                               | [parity][functions] Stacking, splitting, reshaping and flipping (FN-ARR-5)                 |
| #1612 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy | [parity][functions] Indexing helpers, binning and lookup (FN-ARR-6)                        |
| #1613 | P0       | pkg:functions | ref:mathematica                                     | [parity][functions] List and functional primitives (Mathematica Lists & arrays) (FN-ARR-7) |

**Touchpoints (on `main`):**

- Owning package is `functions` even when the label says array creation. Existing surface: `functions/src/matrix/` (`ones.ts`, `reshape.ts`, `concat.ts`, `range.ts`, `flatten.ts`, `partitionSelect.ts`).
- New files stay kebab-case under `functions/src/matrix/` (creation, selection, reductions, sort/set, reshape, indexing). No new `mathjs` filenames.

**Shared-file conflicts:**

All seven issues will want a line in `functions/src/index.ts`. Rule: one in-review PR at a time for that barrel, or each PR only inserts its own sorted export lines and rebases if the barrel moved. Do not let two PRs create the same new file. Category files are disjoint: creation #1604, predicates #1608, reductions #1609, sort/set #1610, reshape #1611, indexing #1612, list/functional #1613.

**Verification:**

NumPy shape/axis/keepdims semantics are the default. MATLAB/Mathcad names that disagree are not the native default (those flags are #1712 in `compat`).

**Exit:**

Each batch's names are exported from `functions/src/index.ts` and covered by an oracle test that would fail on the previous implementation.

### Wave 2A — Correctness bugs (non-CAS)

Issues in this wave: 8.

| Issue | Priority | Package        | References                                                     | Title                                                                                                                                                          |
| ----: | -------- | -------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1592 | P0       | pkg:statistics | ref:matlab, ref:scipy                                          | [parity][statistics] Distribution quantile inversion and chi-square sampler are wrong in the tails (STAT-BUG-1)                                                |
| #1593 | P0       | pkg:statistics | ref:matlab, ref:numpy, ref:scipy                               | [parity][statistics] Test p-values and model-family validation return wrong numbers silently (STAT-BUG-2)                                                      |
| #1594 | P0       | pkg:signal     | ref:matlab, ref:numpy, ref:scipy                               | [parity][signal] FFT family pads to powers of two and ignores size/mode arguments (SIG-BUG-1)                                                                  |
| #1595 | P1       | pkg:signal     | ref:matlab, ref:scipy                                          | [parity][signal] Transform and filter-design correctness (dst, findPeaks, firls, butter, firwinBandpass, zpk2sos) (SIG-BUG-2)                                  |
| #1596 | P0       | pkg:functions  | ref:mathematica, ref:scipy                                     | [parity][functions] Special functions: Fresnel, Si/Ci, gamma near overflow, ellipticF amplitude, hyp2f1 near 1, accuracy (FN-BUG-SPEC)                         |
| #1599 | P0       | pkg:functions  | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][functions] Numeric/array correctness: pchip end slopes, sort with NaN, polyval arrays, continuedFraction, minimizeConstrained infeasible (FN-BUG-NUM) |
| #1601 | P0       | pkg:linalg     | ref:matlab, ref:numpy, ref:scipy                               | [parity][linalg] Linear-algebra correctness: jordanForm, funm, matrixRank tolerance, eigsh convergence, solveBanded pivoting (LINALG-BUG)                      |
| #1603 | P0       | pkg:units      | ref:mathcad                                                    | [parity][units] Units fed to numeric routines give garbage strings or misleading errors (UNITS-BUG)                                                            |

**Touchpoints (on `main`):**

- `#1592` `#1593` `functions/src/probability/`, `functions/src/statistics/`, `functions/src/distribution-functions.ts`, `functions/src/hypothesis-extra.ts`. `statistics/src/index.ts` re-exports.
- `#1594` `#1595` `functions/src/matrix/fft.ts` (public `fft`), `functions/src/signal/fft-core-f64.ts`, `functions/src/signal/iir-design.ts`, `functions/src/signal/spectral-peaks.ts`, `functions/src/signal/zpk2tf.ts`. There are three `fft` implementations; fix the one the issue names and add a regression on the public export.
- `#1596` `functions/src/special/` (`erf.ts`, `hypergeometric.ts`, `jacobi-elliptic.ts`).
- `#1599` interpolation / sort / polynomials / optimization files already under `functions/src/` (`optimization-extra.ts`, `functions/src/algebra/polynomialRoot.ts`, `functions/src/statistics/` sort path).
- `#1601` `matrix/src/operations/` and `functions/src/linalg-extra.ts` / `functions/src/linalg-svd-extra.ts`.
- `#1603` numeric entry points that currently stringify units. Adapter design is #1638; this bug stops the garbage result (throw a `core` error or strip consistently — pick the behavior the issue states, do not invent a third).

**Shared-file conflicts:**

Parallel across statistics, signal, special, linalg, and units. Inside signal, #1594 before #1595 (same FFT/filter files). Inside statistics, #1592 and #1593 touch different families and can run together if they do not edit the same file. #1596 and #1599 are different directories. Nobody in this wave edits `functions/src/cas/` or `functions/src/algebra/simplify.ts`.

**Verification:**

Reproduce the issue's failing case first (`rfl`), then pin SciPy/NumPy/MATLAB. A tail quantile, an FFT length, and a rank tolerance each get a regression that fails on `main`.

**Exit:**

The twelve bug batches' confirmed cases (this wave is eight of the twelve issues; CAS bugs #1597/#1598 and symbolic-regression bug #1600 are Phase 3) match the reference and no longer fail silently.

### Wave 2B — Special functions

Issues in this wave: 6.

| Issue | Priority | Package       | References                                          | Title                                                                                                                          |
| ----: | -------- | ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| #1627 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy | [parity][functions] Special functions: complex and extended domains (FN-SPEC-1)                                                |
| #1628 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy | [parity][functions] Special functions: everyday missing functions (FN-SPEC-2)                                                  |
| #1629 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 1/4) (FN-SPEC-3-p1) |
| #1630 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 2/4) (FN-SPEC-3-p2) |
| #1631 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 3/4) (FN-SPEC-3-p3) |
| #1632 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Special functions: long tail (scipy.special, Wolfram, MATLAB symbolic functions) (part 4/4) (FN-SPEC-3-p4) |

**Touchpoints (on `main`):**

`functions/src/special/` (`erf.ts`, `erf-extra.ts`, `exp-integrals.ts`, `hypergeometric.ts`, `zeta.ts`, `spherical-bessel.ts`, `angular-momentum.ts`, `mathieu.ts`, `spheroidal.ts`, `wave-functions.ts`, `niche.ts`). #1627 and #1628 are P0 everyday/complex domains. #1629–#1632 are the P2 long tail and start after #1627/#1628 so they extend the same helpers instead of forking them.

**Shared-file conflicts:**

One writer per file in `functions/src/special/`. Long-tail parts are serialized. They do not edit `functions/src/signal/` or `functions/src/statistics/`.

**Verification:**

SciPy.special / mpmath / Wolfram for the named functions. Tolerances stated in the test, not a blanket `toBeCloseTo` that hides a wrong branch.

**Exit:**

#1627 and #1628 merged before any #1629–#1632 PR. New specials are callable from `functions/src/index.ts`.

### Wave 2C — Polynomials

Issues in this wave: 4.

| Issue | Priority | Package       | References                         | Title                                                                                                                         |
| ----: | -------- | ------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| #1614 | P0       | pkg:functions | ref:mathcad, ref:matlab, ref:numpy | [parity][functions] Polynomial core: roots of any degree and power-basis series arithmetic (FN-POLY-1)                        |
| #1615 | P2       | pkg:functions | ref:numpy                          | [parity][functions] Orthogonal polynomial series A: Chebyshev and Legendre (numpy.polynomial) (FN-POLY-2)                     |
| #1616 | P2       | pkg:functions | ref:numpy                          | [parity][functions] Orthogonal polynomial series B: Laguerre, Hermite and HermiteE (numpy.polynomial) (FN-POLY-3)             |
| #1617 | P1       | pkg:functions | ref:numpy                          | [parity][functions] Polynomial convenience classes (Polynomial, Chebyshev, Legendre, Laguerre, Hermite, HermiteE) (FN-POLY-4) |

**Touchpoints (on `main`):**

`functions/src/algebra/` (`polynomialRoot.ts`, rational helpers). Orthogonal series are new files under `functions/src/algebra/` or `functions/src/special/polygamma-orthopoly.ts` — extend the existing orthopoly module instead of a second polynomial stack. #1617 classes wrap #1614–#1616.

**Shared-file conflicts:**

#1614 first. #1615 and #1616 are different families and can be parallel if they use different files. #1617 waits for all three.

**Verification:**

NumPy `numpy.polynomial` coefficient conventions (power basis vs orthogonal basis documented in the test name).

**Exit:**

Roots of degree > 4 for the cases #1614 lists, then Chebyshev/Legendre, then Laguerre/Hermite, then convenience classes.

### Wave 2D — Quadrature, ODE, optimization, interpolation, units adapters

Issues in this wave: 11.

| Issue | Priority | Package       | References                                                     | Title                                                                                                    |
| ----: | -------- | ------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| #1633 | P0       | pkg:functions | ref:matlab, ref:numpy, ref:scipy                               | [parity][functions] Quadrature and numeric differentiation (FN-NUM-1)                                    |
| #1634 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][functions] ODE solvers: solve_ivp parity, multistep, dynamical systems (part 1/2) (FN-NUM-2-p1) |
| #1635 | P2       | pkg:functions | ref:mathcad, ref:mathematica                                   | [parity][functions] ODE solvers: solve_ivp parity, multistep, dynamical systems (part 2/2) (FN-NUM-2-p2) |
| #1636 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][functions] Optimization front end (minimize methods, least squares, roots) (FN-NUM-3)           |
| #1637 | P0       | pkg:functions | ref:mathematica, ref:matlab, ref:scipy                         | [parity][functions] MILP, cone/quadratic programming and global optimization (FN-NUM-4)                  |
| #1640 | P0       | pkg:functions | ref:mathcad                                                    | [parity][functions] Mathcad solve blocks (Given/Find/Minerr/Odesolve) (FN-NUM-5)                         |
| #1641 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][functions] Interpolation and splines (part 1/2) (FN-NUM-6-p1)                                   |
| #1642 | P2       | pkg:functions | ref:mathcad, ref:mathematica, ref:scipy                        | [parity][functions] Interpolation and splines (part 2/2) (FN-NUM-6-p2)                                   |
| #1643 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab                       | [parity][functions] Curve fitting objects and regression family (FN-NUM-7)                               |
| #1638 | P0       | pkg:units     | ref:mathcad                                                    | [parity][units] Units through scalar numeric calculus (shared strip/re-attach adapter) (UNITS-1)         |
| #1639 | P0       | pkg:units     | ref:mathcad                                                    | [parity][units] Units through data and matrix routines (UNITS-2)                                         |

**Touchpoints (on `main`):**

- Quadrature and ODE: `functions/src/numeric/`, `functions/src/numeric-extra.ts`, `functions/src/calculus-extra.ts`.
- Optimization: `functions/src/optimization-extra.ts`.
- Interpolation: existing pchip/spline paths fixed in #1599; features extend those files.
- Curve fitting: `functions/src/regression-extra.ts`, `functions/src/fit-scalar.ts`.
- Solve blocks: expression-facing API in `functions/src/` plus `expression/src/` only if #1640 needs a `Given`/`Find` syntax; otherwise keep it a function API.
- `#1638` `#1639` strip/re-attach adapter in `core/src/types/unit/` consumed by the numeric functions above. Depends on #1709 and on the numeric fronts they wrap.

**Shared-file conflicts:**

#1634 before #1635 (same ODE files). #1641 before #1642. #1636 and #1637 share `optimization-extra.ts`: #1636 then #1637. #1638/#1639 land after the scalar routines they wrap exist, and they are the only wave allowed to change the unit adapter. #1640 waits on #1636. #1643 waits on #1636/#1639.

**Verification:**

SciPy `integrate`, `solve_ivp`, `optimize`, `interpolate`. Mathcad Given/Find/Minerr/Odesolve for #1640. Units: a quantity in, a quantity out, same unit the reference attaches.

**Exit:**

P0 issues #1633 #1634 #1636 #1637 #1640 #1641 #1643 #1638 #1639 merged. P2 tails #1635 #1642 may follow inside the phase.

### Wave 2E — Linear algebra features

Issues in this wave: 3.

| Issue | Priority | Package    | References                                                     | Title                                                                                                 |
| ----: | -------- | ---------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| #1703 | P0       | pkg:linalg | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][linalg] Linear algebra options, batching and missing decompositions (part 1/2) (LINALG-1-p1) |
| #1704 | P2       | pkg:linalg | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][linalg] Linear algebra options, batching and missing decompositions (part 2/2) (LINALG-1-p2) |
| #1705 | P1       | pkg:linalg | ref:mathematica, ref:matlab, ref:scipy                         | [parity][linalg] Matrix constructors, special matrices and structure predicates (LINALG-2)            |

**Touchpoints (on `main`):**

`matrix/src/operations/` (`expm.ts`, `logm.ts`, `sqrtm.ts`, `lstsq.ts`) and `functions/src/linalg-extra.ts`, `functions/src/linalg-extra2.ts`, `functions/src/linalg-special-matrices.ts`, `functions/src/linalg-svd-extra.ts`. `linalg/` is a re-export package; do not put implementations there.

**Shared-file conflicts:**

After #1601. #1703 before #1704 (same decomposition files). #1705 (`linalg-special-matrices.ts`) can run beside #1704.

**Verification:**

NumPy/SciPy `linalg` and MATLAB for the decomposition options named in the issue. Batch dimensions must be tested, not only n×n.

**Exit:**

#1703 merged. #1704 and #1705 closed.

### Wave 2F — Signal features

Issues in this wave: 8.

| Issue | Priority | Package    | References                                                     | Title                                                                                                       |
| ----: | -------- | ---------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| #1695 | P0       | pkg:signal | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][signal] FFT completeness (SIG-1)                                                                   |
| #1696 | P0       | pkg:signal | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][signal] Filtering API and filter design (part 1/2) (SIG-2-p1)                                      |
| #1697 | P1       | pkg:signal | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][signal] Filtering API and filter design (part 2/2) (SIG-2-p2)                                      |
| #1698 | P0       | pkg:signal | ref:mathcad, ref:matlab, ref:scipy                             | [parity][signal] Spectral estimation, linear prediction and signal measurements (part 1/2) (SIG-3-p1)       |
| #1699 | P1       | pkg:signal | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][signal] Spectral estimation, linear prediction and signal measurements (part 2/2) (SIG-3-p2)       |
| #1700 | P0       | pkg:signal | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][signal] Windows, waveform generation and smoothing (SIG-4)                                         |
| #1701 | P0       | pkg:signal | ref:matlab, ref:scipy                                          | [parity][signal] Multirate, wavelets, time-frequency and DSP System toolbox long tail (part 1/2) (SIG-5-p1) |
| #1702 | P2       | pkg:signal | ref:matlab, ref:scipy                                          | [parity][signal] Multirate, wavelets, time-frequency and DSP System toolbox long tail (part 2/2) (SIG-5-p2) |

**Touchpoints (on `main`):**

`functions/src/signal/` (`fft-core-f64.ts`, `fft.ts`, `iir-design.ts`, `windows-extra.ts`, `waveforms.ts`, `wavelets.ts`, `wavelet-filters.ts`, `lomb-scargle.ts`, `spectral-segments.ts`, `system-response.ts`, `fir-smoothing.ts`) and the public factory `functions/src/matrix/fft.ts`. `signal/src/index.ts` re-exports. Do not wire the WASM FFT kernel: it measured slower than `fft-core-f64.ts`.

**Shared-file conflicts:**

After #1594/#1595. Pairs: #1695 alone (FFT files); #1696 then #1697 (filter design); #1698 then #1699 (spectral); #1700 parallel (windows file); #1701 then #1702 (wavelets).

**Verification:**

SciPy.signal / NumPy FFT / MATLAB Signal Processing toolbox for the names in each issue. Length and `axis` follow #1594's corrected contract.

**Exit:**

P0 #1695 #1696 #1698 #1700 #1701 merged before the phase is called done. P1/P2 parts may complete in the same phase without blocking Phase 3.

### Wave 2G — Statistics features

Issues in this wave: 19.

| Issue | Priority | Package        | References                                                     | Title                                                                              |
| ----: | -------- | -------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| #1676 | P0       | pkg:statistics | ref:mathematica, ref:scipy                                     | [parity][statistics] Distribution object API breadth (STAT-1)                      |
| #1677 | P0       | pkg:statistics | ref:mathematica, ref:matlab, ref:scipy                         | [parity][statistics] Probability distribution families (part 1/5) (STAT-2-p1)      |
| #1678 | P1       | pkg:statistics | ref:mathematica, ref:matlab, ref:scipy                         | [parity][statistics] Probability distribution families (part 2/5) (STAT-2-p2)      |
| #1679 | P2       | pkg:statistics | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][statistics] Probability distribution families (part 3/5) (STAT-2-p3)      |
| #1680 | P2       | pkg:statistics | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][statistics] Probability distribution families (part 4/5) (STAT-2-p4)      |
| #1681 | P2       | pkg:statistics | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy            | [parity][statistics] Probability distribution families (part 5/5) (STAT-2-p5)      |
| #1682 | P0       | pkg:statistics | ref:mathematica, ref:matlab, ref:numpy                         | [parity][statistics] Random Generator API and samplers (NumPy Generator) (STAT-3)  |
| #1683 | P0       | pkg:statistics | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][statistics] Descriptive statistics completion (part 1/3) (STAT-4-p1)      |
| #1684 | P2       | pkg:statistics | ref:mathcad, ref:mathematica, ref:scipy                        | [parity][statistics] Descriptive statistics completion (part 2/3) (STAT-4-p2)      |
| #1685 | P2       | pkg:statistics | ref:mathcad, ref:mathematica, ref:scipy                        | [parity][statistics] Descriptive statistics completion (part 3/3) (STAT-4-p3)      |
| #1686 | P0       | pkg:statistics | ref:mathematica, ref:matlab, ref:scipy                         | [parity][statistics] Hypothesis tests, ANOVA and resampling (STAT-5)               |
| #1687 | P1       | pkg:statistics | ref:matlab                                                     | [parity][statistics] Distribution fitting and likelihoods (STAT-6)                 |
| #1688 | P0       | pkg:statistics | ref:mathematica, ref:matlab                                    | [parity][statistics] Regression models and dimensionality reduction (STAT-7)       |
| #1689 | P0       | pkg:statistics | ref:matlab, ref:scipy                                          | [parity][statistics] Spatial distances and clustering (STAT-8)                     |
| #1690 | P1       | pkg:statistics | ref:scipy                                                      | [parity][statistics] Quasi-Monte Carlo sampling (STAT-9)                           |
| #1691 | P1       | pkg:statistics | ref:mathematica, ref:matlab                                    | [parity][statistics] Random processes and time series (part 1/2) (STAT-10-p1)      |
| #1692 | P2       | pkg:statistics | ref:mathematica                                                | [parity][statistics] Random processes and time series (part 2/2) (STAT-10-p2)      |
| #1693 | P0       | pkg:statistics | ref:mathcad, ref:matlab                                        | [parity][statistics] Design of experiments and industrial statistics (STAT-11)     |
| #1694 | P0       | pkg:statistics | ref:matlab                                                     | [parity][statistics] Missing data, outliers and moving-window statistics (STAT-12) |

**Touchpoints (on `main`):**

`functions/src/probability/`, `functions/src/distribution-functions.ts`, `functions/src/statistics/`, `functions/src/descriptive-stats.ts`, `functions/src/hypothesis-extra.ts`, `functions/src/regression-extra.ts`, `functions/src/clustering-extra.ts`. `statistics/src/index.ts` re-exports.

**Shared-file conflicts:**

Order from #1714: #1592 before #1676; #1676 before #1677–#1681; #1687 after the distribution parts it fits; #1593 before #1686. Parallel once those gates are open: #1682 (Generator), #1683 then #1684/#1685, #1688, #1689, #1690, #1691 then #1692, #1693, #1694 — disjoint files, one barrel editor at a time.

**Verification:**

SciPy.stats and NumPy Generator. Distribution quantiles use the #1592 inversion, not a second implementation.

**Exit:**

#1676, #1677, #1682, #1683, #1686, #1688, #1689, #1693, #1694 (all P0) merged. Fitting #1687 waits on distribution families it names.

### Wave 2H — Geometry, graphs, discrete, control, PDE, finance, image

Issues in this wave: 21.

| Issue | Priority | Package       | References                                          | Title                                                                                                                    |
| ----: | -------- | ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| #1655 | P0       | pkg:functions | ref:mathematica, ref:matlab, ref:scipy              | [parity][functions] Computational geometry and regions (part 1/4) (FN-GEOM-1-p1)                                         |
| #1656 | P2       | pkg:functions | ref:mathematica                                     | [parity][functions] Computational geometry and regions (part 2/4) (FN-GEOM-1-p2)                                         |
| #1657 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Computational geometry and regions (part 3/4) (FN-GEOM-1-p3)                                         |
| #1658 | P2       | pkg:functions | ref:mathematica                                     | [parity][functions] Computational geometry and regions (part 4/4) (FN-GEOM-1-p4)                                         |
| #1659 | P0       | pkg:functions | ref:mathematica, ref:matlab, ref:scipy              | [parity][functions] Graphs and networks (part 1/3) (FN-GRAPH-1-p1)                                                       |
| #1660 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Graphs and networks (part 2/3) (FN-GRAPH-1-p2)                                                       |
| #1661 | P2       | pkg:functions | ref:mathematica, ref:scipy                          | [parity][functions] Graphs and networks (part 3/3) (FN-GRAPH-1-p3)                                                       |
| #1662 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab            | [parity][functions] Number theory (FN-NT-1)                                                                              |
| #1663 | P0       | pkg:functions | ref:mathematica, ref:matlab                         | [parity][functions] Combinatorics and discrete math (part 1/2) (FN-COMB-1-p1)                                            |
| #1664 | P2       | pkg:functions | ref:mathematica                                     | [parity][functions] Combinatorics and discrete math (part 2/2) (FN-COMB-1-p2)                                            |
| #1665 | P0       | pkg:functions | ref:mathematica, ref:matlab, ref:scipy              | [parity][functions] Control systems: LTI models and classical design (FN-CTRL-1)                                         |
| #1666 | P1       | pkg:functions | ref:mathematica, ref:matlab                         | [parity][functions] Control systems: estimation, reduction and discretisation (part 1/2) (FN-CTRL-2-p1)                  |
| #1667 | P2       | pkg:functions | ref:mathematica, ref:matlab                         | [parity][functions] Control systems: estimation, reduction and discretisation (part 2/2) (FN-CTRL-2-p2)                  |
| #1668 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab            | [parity][functions] PDE and FEM (part 1/2) (FN-PDE-1-p1)                                                                 |
| #1669 | P2       | pkg:functions | ref:mathematica, ref:matlab                         | [parity][functions] PDE and FEM (part 2/2) (FN-PDE-1-p2)                                                                 |
| #1670 | P2       | pkg:functions | ref:mathcad, ref:mathematica                        | [parity][functions] Finance and actuarial (FN-FIN-1)                                                                     |
| #1671 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy | [parity][functions] Image processing A: filtering, enhancement, colour and histograms (part 1/3) (FN-IMG-1-p1)           |
| #1672 | P2       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:scipy | [parity][functions] Image processing A: filtering, enhancement, colour and histograms (part 2/3) (FN-IMG-1-p2)           |
| #1673 | P2       | pkg:functions | ref:mathcad, ref:mathematica, ref:scipy             | [parity][functions] Image processing A: filtering, enhancement, colour and histograms (part 3/3) (FN-IMG-1-p3)           |
| #1674 | P0       | pkg:functions | ref:mathcad, ref:matlab, ref:scipy                  | [parity][functions] Image processing B: morphology, segmentation, geometry and image transforms (part 1/2) (FN-IMG-2-p1) |
| #1675 | P2       | pkg:functions | ref:mathcad, ref:matlab, ref:scipy                  | [parity][functions] Image processing B: morphology, segmentation, geometry and image transforms (part 2/2) (FN-IMG-2-p2) |

**Touchpoints (on `main`):**

Existing homes: `functions/src/geometry/`, `functions/src/geometry-extra.ts`, `functions/src/graph/`, `functions/src/numbertheory/`, `functions/src/combinatorics/`. Control, PDE/FEM, finance, and image need new kebab-case directories under `functions/src/` (`control/`, `pde/`, `finance/`, `image/`) because those trees are not on `main` today. Do not create them under `compat/`.

**Shared-file conflicts:**

Each family is its own directory, so the eight families run in parallel. Inside a family, part 1 before later parts (they share helpers): geometry #1655 → #1656/#1657/#1658; graphs #1659 → #1660 → #1661; combinatorics #1663 → #1664; control #1665 → #1666 → #1667; PDE #1668 → #1669; image A #1671 → #1672 → #1673 and image B #1674 → #1675 (A and B different directories). Finance #1670 is a single issue.

**Verification:**

SciPy.spatial / MATLAB for geometry and image morphology named in the issues. Number theory against exact integer oracles (Python ints / SymPy), not float residual checks.

**Exit:**

Every P0 in this wave (#1655 #1659 #1662 #1663 #1665 #1668 #1671 #1674) merged. P2 tails can trail without blocking Phase 4 plot helpers that only need #1655.

### Wave 3A — CAS correctness

Issues in this wave: 2.

| Issue | Priority | Package       | References                                          | Title                                                                                                                                                                         |
| ----: | -------- | ------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1597 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy | [parity][functions] CAS silent wrong answers: casSimplify negation, collect, fullSimplify decimals, string-coefficient helpers, zTransform placeholder (FN-BUG-CAS-1)         |
| #1598 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy | [parity][functions] CAS calculus wrong/incomplete results: series poles, numeric limits, solve missing complex roots, integrate front door, definite integrate (FN-BUG-CAS-2) |

**Touchpoints (on `main`):**

`functions/src/algebra/simplify.ts`, `simplifyCore.ts`, `simplifyConstant.ts`, `rationalize.ts`, `derivative.ts`, `functions/src/cas/` (`antiderivative.ts`, `elementary-solve.ts`, `taylor-jet.ts`, `polynomial-limits.ts`, `rational-integrate.ts`). Expression printing stays in `expression/src/node/` when the bug is a string form.

**Shared-file conflicts:**

#1597 (simplify/transform) and #1598 (calculus/solve) share `functions/src/cas/` and `functions/src/algebra/simplify.ts`. Serialize them, #1597 then #1598, unless the patch sets are proven disjoint.

**Verification:**

SymPy is the executing oracle. A silent wrong answer needs a regression that asserts the SymPy form, not merely "does not throw".

**Exit:**

Both issues closed. The cases named in the titles (negation, collect, decimals, zTransform placeholder, series poles, complex roots, definite integrate) match SymPy.

### Wave 3B — CAS breadth

Issues in this wave: 9.

| Issue | Priority | Package       | References                               | Title                                                                                                      |
| ----: | -------- | ------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| #1618 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab | [parity][functions] CAS simplify engine and formula manipulation (FN-CAS-1)                                |
| #1619 | P0       | pkg:functions | ref:mathematica, ref:matlab              | [parity][functions] Symbolic integration and differentiation breadth (FN-CAS-2)                            |
| #1620 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab | [parity][functions] Series, limits and function analysis (FN-CAS-3)                                        |
| #1621 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab | [parity][functions] Equation solving breadth (symbolic) (FN-CAS-4)                                         |
| #1622 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab | [parity][functions] Generalised functions, integral transforms, symbolic sums and recurrences (FN-CAS-5)   |
| #1623 | P1       | pkg:functions | ref:mathematica, ref:matlab              | [parity][functions] DSolve: symbolic ODE solving (FN-CAS-6)                                                |
| #1624 | P0       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab | [parity][functions] Symbolic core, polynomial algebra and symbolic linear algebra (part 1/3) (FN-CAS-7-p1) |
| #1625 | P1       | pkg:functions | ref:mathcad, ref:mathematica, ref:matlab | [parity][functions] Symbolic core, polynomial algebra and symbolic linear algebra (part 2/3) (FN-CAS-7-p2) |
| #1626 | P2       | pkg:functions | ref:mathcad, ref:mathematica             | [parity][functions] Symbolic core, polynomial algebra and symbolic linear algebra (part 3/3) (FN-CAS-7-p3) |

**Touchpoints (on `main`):**

Same trees as 3A: `functions/src/cas/`, `functions/src/algebra/`, `functions/src/cas-integration.ts`. Symbolic linear algebra reuses `matrix/src/operations/` only through a symbolic entry type; do not fork a second matrix package.

**Shared-file conflicts:**

After 3A. #1624 → #1625 → #1626 (one symbolic-core stack). #1618 (simplify) before #1619–#1622. #1623 (ODEs) after #1619 and after numeric ODE #1634 so symbolic and numeric solvers do not share a half-built API. #1620/#1621/#1622 can parallelize only on disjoint new files.

**Verification:**

SymPy for calculus and solve. Mathematica/MATLAB names that differ in branch cuts get an explicit test comment citing the reference row.

**Exit:**

P0 #1618 #1619 #1620 #1621 #1622 #1624 merged. #1623 #1625 #1626 may finish in-phase.

### Wave 3C — Expression language

Issues in this wave: 1.

| Issue | Priority | Package        | References  | Title                                                                                                        |
| ----: | -------- | -------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| #1711 | P0       | pkg:expression | ref:mathcad | [parity][expression] Expression language: ranges, vectorisation, ORIGIN/TOL and worksheet operators (EXPR-1) |

**Touchpoints (on `main`):**

`expression/src/parse.ts`, `expression/src/Parser.ts`, `expression/src/operators.ts`, `expression/src/keywords.ts`, `expression/src/node/`, `expression/src/compiler/`. Property access still goes through `expression/src/utils/customs.ts` (`getSafeProperty` / `setSafeProperty` / `getSafeMethod`).

**Shared-file conflicts:**

Single issue, single writer for `expression/src/operators.ts`. Does not change `compat/` parser shims (those are #1786 in the prerequisite plan).

**Verification:**

Mathcad worksheet operators named in #1711. Sandbox regression `expression/tests/security/sandbox.test.ts` stays green.

**Exit:**

Ranges, vectorisation, and ORIGIN/TOL behave as #1711 specifies, with sandbox tests still forbidding direct `obj[name]` access.

### Wave 3D — Symbolic regression

Issues in this wave: 11.

| Issue | Priority | Package       | References | Title                                                                                                                                          |
| ----: | -------- | ------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| #1600 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: AbortSignal/timeouts cannot stop searchScalars, Huber loss is 2x, unknown options ignored (FN-BUG-SR) |
| #1644 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: per-leaf constant optimisation (FN-SR-2)                                                              |
| #1645 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: operator registry and smooth operators (FN-SR-3)                                                      |
| #1646 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: non-smooth and logical operators (FN-SR-4)                                                            |
| #1647 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: user-defined operators (FN-SR-5)                                                                      |
| #1648 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: losses and objectives (FN-SR-6)                                                                       |
| #1650 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: parsimony, complexity and stopping (FN-SR-8)                                                          |
| #1653 | P1       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: estimator object, persistence, monitoring and export (FN-SR-11)                                       |
| #1654 | P2       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: expression specs and types (FN-SR-12)                                                                 |
| #1651 | P2       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: evolution controls, mutations and migration (FN-SR-9)                                                 |
| #1652 | P2       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: data-scale features (FN-SR-10)                                                                        |

**Touchpoints (on `main`):**

`functions/src/scalar-search.ts`, `scalar-eval.ts`, `scalar-compile.ts`, `scalar-mutate.ts`, `scalar-node-bridge.ts`, `scalar-dimension.ts`, `fit-scalar.ts`, `scalar-batch-parallel.ts`, `scalar-batch-task.ts`, `scalar-batch.worker.ts`. #1600 is the bug (AbortSignal, Huber ×2, unknown options) and lands first.

**Shared-file conflicts:**

#1600 first. Then operator/loss/API issues on disjoint files where possible: #1645/#1646/#1647 (operators), #1648 (losses), #1644 (constants), #1650 (parsimony), #1653 (estimator object) ordered because the estimator wraps the others. #1654 after units adapter #1638. Throughput #1649 is Phase 4, not this wave. #1651 and #1652 are P2 and follow #1650.

**Verification:**

PySR 2.7.3 behavior for loss scale, operator sets, and stopping. #1600 must show a cancelled search stops. No new runtime dependency (no Julia, no Python).

**Exit:**

#1600 and the P1 issues #1644 #1645 #1646 #1647 #1648 #1650 #1653 merged. Search remains stoppable.

### Wave 4A — Symbolic-regression throughput

Issues in this wave: 1.

| Issue | Priority | Package       | References | Title                                                                              |
| ----: | -------- | ------------- | ---------- | ---------------------------------------------------------------------------------- |
| #1649 | P2       | pkg:functions | ref:pysr   | [parity][functions] Symbolic regression: throughput (35-45x gap vs PySR) (FN-SR-7) |

**Touchpoints (on `main`):**

Same scalar-search files as Phase 3D. Also the legal acceleration homes if a measurement says so: `parallel/src/ComputePool.ts`, `packages/workerpool/src/`, `gpu/src/flag.ts` (`enableGpu` stays opt-in, f32 only). WASM dispatch stays behind `functions/src/wasm/policy.ts`. Do not add a GPU path that returns `null` and gets timed as a win.

**Shared-file conflicts:**

After Phase 3D functional issues. One PR. Do not share the scalar-search files with a late 3D PR.

**Verification:**

Re-measure with the repo A/B harness (`tools/benchmark/ab/`) against the pre-change tree. A claim of closing the 35–45× PySR gap requires that harness on Node, two runs. Workers and GPU are allowed only when the measured public symbol wins.

**Exit:**

#1649 closed with a committed benchmark row. No tier is wired on the assumption that WASM or GPU is faster.

### Wave 4B — Compat convention flags

Issues in this wave: 1.

| Issue | Priority | Package    | References                                                     | Title                                                                                          |
| ----: | -------- | ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| #1712 | P1       | pkg:compat | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:scipy | [parity][compat] Reference-system convention options (MATLAB, Mathcad, Mathematica) (COMPAT-1) |

**Touchpoints (on `main`):**

`compat/src/` only (`function-reexports.ts` is one sorted name per line; new wrappers in their own file re-exported from `named-instance-exports.ts`). Native `functions` defaults stay NumPy-like. MATLAB kurtosis, Mathcad `mod` sign, and argument-order switches are compat flags.

**Shared-file conflicts:**

Depends on #1604 and #1694. Does not edit `core/`, `matrix/`, `functions/src/`, `packages/workerpool`, `gpu`, or `parallel` to imitate a reference-system quirk.

**Verification:**

Each of the 27 rows in #1712 has a compat test that sets the flag and checks the reference value, plus a test that the flag-off path is unchanged.

**Exit:**

#1712 merged. Native packages gained no mathjs-only or MATLAB-only default.

### Wave 4C — Plot data helpers

Issues in this wave: 1.

| Issue | Priority | Package  | References  | Title                                                           |
| ----: | -------- | -------- | ----------- | --------------------------------------------------------------- |
| #1713 | P1       | pkg:plot | ref:mathcad | [parity][plot] Plot data helpers from Mathcad graphing (PLOT-1) |

**Touchpoints (on `main`):**

`plot/src/` (`histogram.ts`, `marks2d.ts`, `heatmap.ts`, `contour.ts`, `coerce.ts`). Helpers that compute data (histograms, grids) and belong to geometry stay in `functions/src/geometry/` if #1655 already grew them; `plot` consumes them.

**Shared-file conflicts:**

After #1655. `plot/src/index.ts` is single-writer. Does not import Node builtins into the browser entry (`plot` `./render` is already the Node-only subpath).

**Verification:**

Mathcad graphing helpers named in #1713. Output remains SVG/TikZ strings.

**Exit:**

#1713 merged. Browser entry still has no `node:` import (existing dist browser-safety gate).

### Wave 4D — Tracker close

Issues in this wave: 1.

| Issue | Priority | Package | References                                                               | Title                                                                                |
| ----: | -------- | ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| #1714 | —        | —       | ref:mathcad, ref:mathematica, ref:matlab, ref:numpy, ref:pysr, ref:scipy | [parity] Six-system parity tracker: NumPy, SciPy, PySR, Mathematica, Mathcad, MATLAB |

**Touchpoints (on `main`):**

No product code. Close #1714 when every issue it lists (#1592–#1713) is closed. The checklist in the issue body is the scoreboard.

**Shared-file conflicts:**

Last. Documentation-only update if the checklist needs a final tick, in a follow-up that does not reopen feature work.

**Verification:**

`gh issue view 1714` shows every child closed.

**Exit:**

#1714 closed. Open-issue count from the parity program is zero, apart from any new issues filed after this snapshot.

## Phase exit criteria

| Phase        | Exit                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisite | Compat plan waves merged and `@danielsimonjr/mathts-compat` released against mathjs 15.3.0. #1773 and #1776–#1794 closed.                                                                                |
| Phase 0      | #1799 and #1800 merged. `core/src/error/` has no `mathjs` filename. Native filenames have no `mathjs`.                                                                                                   |
| Phase 1      | Waves 1A–1D exited. P0 issues #1604, #1605, #1607, #1608, #1609, #1610, #1611, #1612, #1613, #1706, #1707, #1708, and #1709 merged. #1606 (P1), #1602 (P1), and #1710 (P2) may finish in the same phase. |
| Phase 2      | Waves 2A–2H P0 issues merged. A P2 long-tail issue may stay open only if its part-1 P0 gate is merged and the phase exit note above names it.                                                            |
| Phase 3      | #1597 #1598 #1618–#1622 #1624 #1711 #1600 and the P1 symbolic-regression issues merged. Expression sandbox tests still pass.                                                                             |
| Phase 4      | #1649 #1712 #1713 #1714 closed. Tracker children #1592–#1713 are already closed.                                                                                                                         |

## What this plan does not do

- It does not re-plan #1773 or #1776–#1794.
- It does not add a GPU, worker-pool, or typed-function issue. None is open.
- It does not move mathjs quirks into native packages.
- It does not change code, config, or workflows. Those land in later implementation PRs.
