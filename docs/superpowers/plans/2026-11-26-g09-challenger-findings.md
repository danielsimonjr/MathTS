# CHALLENGER findings — G09 (#1557) indexed assignment that grows a matrix

**Stage:** adversarial challenge of PR #1761 (builder head `9277b26b943031b1ad14871bd6e88be4a6dd5b1c`).
**Oracle:** live `mathjs@15.3.0` (the `compat` devDependency), used through the repo's own
`compat/tests/parity/differential.ts` (`expectSame`) and `oracle.ts` (`pair`) harnesses.
**Result:** the builder's central claim holds — **matrix _growth_ itself matches mathjs**. But
the claim "#1557 already matches mathjs 15.3.0" is **too broad**: two real, deterministic
parity defects live inside #1557's own scope and are **not** covered by the added suite.

All findings are pinned as failing tests in
`compat/tests/parity/challenger-g09-findings.test.ts` (run: `cd compat && bunx vitest run
tests/parity/challenger-g09-findings.test.ts` → `10 failed | 6 passed`; the 6 passing ones are
the controls that bound the findings).

---

## What the builder got right (verified, not assumed)

Every growth case below was probed against live mathjs 15.3.0 and **matches** on both the stored
value and the assignment result:

| probe                                                                       | result (both sides)               |
| --------------------------------------------------------------------------- | --------------------------------- |
| `e = []; e[1, 1:2] = [5, 6]; e[2, :] = [7, 8]`                              | `DenseMatrix [[5, 6], [7, 8]]`    |
| `a = []; a[3] = 4`                                                          | `DenseMatrix [0, 0, 4]` (pad `0`) |
| `m = []; m[2, 3, 2] = 9`                                                    | 2×3×2 padded `DenseMatrix`        |
| `e = []; e[2, 3] = 9`                                                       | 2×3 padded                        |
| `e = [[1,2],[3,4]]; e[3, :] = [5, 6]`                                       | `[[1,2],[3,4],[5,6]]`             |
| `m = [1,2,3]; m[2, 1] = 5` (1-D → 2-D)                                      | 2×3 padded                        |
| `number: 'BigNumber'` pad                                                   | pads `BigNumber(0)`               |
| `number: 'Fraction'` pad                                                    | pads `Fraction(0)`                |
| `matrix: 'Array'` / `'Matrix'`                                              | both match                        |
| `legacySubset: true`                                                        | growth matches                    |
| Complex / Unit / string / boolean entries                                   | match                             |
| `e[1, 2, 1:3]` shape mismatch, `a[1,1,1,1] = 1`, non-integer index, `a[-1]` | same class of error / same accept |

So the auto-resize path is genuinely correct. The two defects below are adjacent, in the same
`subset`/assignment code path the issue names as its root cause, and both are reachable from
the exact expressions #1557 is about.

---

## F1 — a column-indexed assignment returns the wrong _shape_

mathjs broadcasts the replacement to the index's shape and returns **that**, so writing a
**column** with a row vector returns a **column**. compat stores the right matrix but returns the
un-reshaped row.

| expression                                    | mathjs 15.3.0                | compat               | stored matrix                   |
| --------------------------------------------- | ---------------------------- | -------------------- | ------------------------------- |
| `e = [[1,2],[3,4]]; e[:, 2] = [9, 9]`         | `DenseMatrix [[9], [9]]`     | `DenseMatrix [9, 9]` | identical (`[[1,9],[3,9]]`)     |
| `e = [[1,2],[3,4]]; e[:, 3] = [5, 6]` (grows) | `DenseMatrix [[5], [6]]`     | `DenseMatrix [5, 6]` | identical (`[[1,2,5],[3,4,6]]`) |
| `e = [[1,2],[3,4]]; e[1:2, 2] = [9, 9]`       | `DenseMatrix [[9], [9]]`     | `DenseMatrix [9, 9]` | identical                       |
| `m = zeros(2,2,2); m[1, :, 1] = [5, 6]`       | `DenseMatrix [[5], [6]]`     | `DenseMatrix [5, 6]` | identical                       |
| `m = zeros(2,2,2); m[:, 1, 1] = [5, 6]`       | `DenseMatrix [[[5]], [[6]]]` | `DenseMatrix [5, 6]` | identical                       |

Why this is in scope: the issue's _own_ acceptance criterion is "differential test of indexed
assignment that grows 1-D and 2-D matrices (scalars, ranges, `:`)" asserting equal `typeOf` +
`format(precision 14)`; two of the rows above contain a `:` and a growth. It also applies with
**no** growth (`e[:, 2]`), so it is a property of indexed _assignment_ itself, not of resizing.

Controls that pass (so this is specifically the column/`:` axis, not assignment generally):

- `e[1, :] = [9, 9]` → `DenseMatrix [9, 9]` (row write) — **matches**.
- `e[1, 2] = 9` → `ResultSet [9]` (scalar) — **matches**.
- `e[1, 1:2] = [9, 9]`, `e[1:2, 1:2] = [9, 9]` — **match**.
- With a column-shaped RHS (`e[:, 2] = [[9], [9]]`) both return `[[9], [9]]` — **matches**.
  So the divergence is exactly "mathjs reshapes the RHS to the index shape; compat does not."

`ResultSet`-wrapped form has the same defect (`e = [[1,2],[3,4]]; e[:, 2] = [9, 9]` →
`ResultSet [[[9], [9]]]` vs `ResultSet [[9, 9]]`).

Likely root cause (traced, not guessed): the expression `assign` in
`expression/src/node/utils/assign.ts` returns the **value** of the assignment node, and the
`AssignmentNode._compile` path returns `evalValue(...)` — the raw RHS — rather than the reshaped
replacement that `DenseMatrix.subset` actually wrote. mathjs's `AssignmentNode` also returns the
RHS, but mathjs's `subset` **mutates the replacement in place** before it writes, so by the time
the RHS is returned it already has the column shape. In compat the reshape happens on an internal
`rep` local inside `MathJSDenseMatrix._setSubset` (`functions/src/factories/matrix-bridge.ts`),
so the caller's array — and therefore the returned value — keeps its original row shape. The
stored matrix agrees because `_setSubset` writes the reshaped `rep` into the data; only the
_returned_ value differs.

---

## F2 — assignment through an _empty_ index on an _empty_ matrix must throw

mathjs raises; compat silently returns the value and leaves the data empty (in the 2-D form it
even records the grown-but-empty shape `[0, 1]`).

| expression              | mathjs 15.3.0                                                | compat                                              |
| ----------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `a = []; a[:] = 5`      | `Error: shape mismatch: … dimension 1 with size 1 to size 0` | returns `5`, `a` stays `[]` (size `[0]`)            |
| `e = []; e[:, 1] = 5`   | `DimensionError: Dimension mismatch ([0, 1] > [1, 1])`       | returns `5`, `e` becomes size `[0, 1]` (empty data) |
| `a = []; a[1:0] = 3`    | `Error: shape mismatch: …`                                   | returns `3`, `a` stays `[]` (size `[0]`)            |
| `a = []; a[2:1] = 3`    | `Error: shape mismatch: …`                                   | returns `3`, `a` stays `[]` (size `[0]`)            |
| `e = []; e[1:0, 1] = 3` | `DimensionError: Dimension mismatch ([0, 1] > [1, 1])`       | returns `3`, `e` becomes size `[0, 1]` (empty data) |

Deterministic across `{}`, `{matrix:'Array'}`, `{number:'BigNumber'}`, `{number:'Fraction'}`,
`{legacySubset:true}`.

Root cause (traced in source and confirmed empirically): in `MathJSDenseMatrix._setSubset`
(`functions/src/factories/matrix-bridge.ts`) a **scalar** replacement is written entry by entry over
the selected indices; a zero-length selection has no entries, so the loop does nothing and the
method returns the matrix unchanged. mathjs's `DenseMatrix._set` instead **broadcasts a scalar
replacement to the selection shape first** (`submatrix = broadcastTo([submatrix], iSize)`), and
`broadcastTo([5], [0])` (and `[0, 1]`) throws `shape mismatch` / `Dimension mismatch` for a zero
axis — which is the error mathjs reports. Direct probes confirm the mechanism: on both sides
`matrix([]).subset(index(range(1, 0)), [])` (an array replacement matching the zero-length
selection) succeeds and yields size `[0]`; only the **scalar** replacement diverges, which is
exactly the broadcast step. `isEmptyIndex` is a red herring — it already returns `false` for these
indices on compat (`Range(0, -1)` has `size [0]`, not `start === end`).

Why this is in scope: the plan's G09 Design says "Ranges and `:` grow 1-D and 2-D the same way
`subset` does" — the empty-`:` and empty-range inputs are the boundary of exactly that rule, and
they diverge. The issue's own acceptance criterion "differential test … (scalars, ranges, `:`)"
covers ranges and `:`.

---

## Secondary observation (not counted as a finding)

`SparseMatrix` growth via a `:`/range produces the same entries but a **different internal
iteration order**, so `format()` prints them in a different order than mathjs
(`s = sparse([[1,2],[3,4]]); s[3, :] = [5, 6]`). `toArray()` and `size()` agree, and the
non-growth sparse set agrees. This is a `SparseMatrix` representation/format concern rather than
an assignment-resize defect, so it is reported here for the record and deliberately **not** pinned
as a failing test (doing so would assert mathjs's internal entry order, which is not a #1557
contract). It is worth a separate look if sparse formatted output is meant to be byte-identical to
mathjs.

---

## Suggested follow-up (not done here — this is a challenge, not a fix)

1. **F1:** make the returned assignment value carry the reshaped replacement, as mathjs does — e.g.
   have `MathJSDenseMatrix._setSubset` write the reshaped `rep` back through the caller's reference
   the way mathjs mutates its RHS, or have the expression `assign` return the reshaped value. Then
   `e[:, k] = rowVector` returns a column.
2. **F2:** broadcast a scalar replacement to the selection shape before writing it, as mathjs's
   `DenseMatrix._set` does (`broadcastTo([submatrix], iSize)`), so a zero-length selection raises
   the same `shape mismatch` / `Dimension mismatch` instead of a silent no-op.
3. Add the rows above to `compat/tests/parity/g09-resize-assign.test.ts` (or its successor) so the
   regression suite actually covers the `:`/column boundary it claims to.
