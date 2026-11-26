# G05 challenger findings — PR #1762 (`#1553`, `#1584`)

**Verdict: DEFECTS FOUND.** The builder head
`b7d3726e32c975196bf0ae075076580a295863da` (branch
`cursor/g05-bignumber-matrix-parity-c329`) is **not** parity-clean. Four
findings, all in the compat adapter (`compat/src/mathjs-parity-g05.ts`); none
requires a critical-library change, but the commit's central claim about
BigNumber `schur` is wrong.

Falsifying tests: `compat/tests/parity/challenger-g05.test.ts` — 7 tests, all
FAIL on the builder head, all PASS once the findings are fixed.

Oracle: the live mathjs 15.3.0 devDependency, via the repo's own harness rule
(`typeOf` + `format(value, { precision: 14 })`, or the thrown error name and
first message clause).

---

## F1 (P1) — BigNumber `schur` stops one iterate early; it is NOT a "decimal backend digit difference"

The commit message, the changeset, and `docs/api/compat.md` all say:

> A BigNumber `schur` is the one place where compat can differ from the mathjs
> oracle in the last digits: mathjs computes BigNumber QR with decimal.js at
> precision 64, compat with the MathTS decimal. The iteration is chaotic at the
> ulp level, so `T` can stop at a different iterate …

This is wrong in its diagnosis and understates the divergence by six orders of
magnitude.

**Repro** (BigNumber config, `schur([[1,2],[3,4]])`):

|                      | `T[0][0]`               | error vs true eigenvalue |
| -------------------- | ----------------------- | ------------------------ |
| mathjs 15.3.0 oracle | `5.372281311118045301…` | `1.215e-8`               |
| compat               | `5.372281323269014329…` | `0.0`                    |

The precision-14 formats differ (`5.3722813111180` vs `5.3722813232690`), so this
is a 12-digit difference, not a last-digit one, and the parity harness rule
fails on it.

**Root cause — the stopping rule, not the arithmetic.** I re-ran the QR loop by
hand, step for step, on both instances. The iterate matrix is **bit-identical at
every step** (`A`, `A0`, `subtract(A, A0)` all match to the last digit,
including step 6 where the loop decides to stop). The stop test is
`norm(subtract(A, A0)) > 1e-4`, and **that `norm` is the only thing that
differs**:

- The loop converges toward a matrix with a `2.0`-sized off-diagonal residue
  (`A6 - A5 = [[2.7e-6, -2.0], [-1.35e-5, -2.7e-6]]`), so the true L2 norm of
  the step is **2.0** — above `1e-4` — and the loop should keep going.
- The **compat** `norm` computes the true 2-norm (`1.9999990625…`) and keeps
  iterating (~100 times) to the correct eigenvalue.
- The **mathjs** `norm` computes **`9.37e-7`** — below `1e-4` — so mathjs's own
  `schur` stops after 7 iterations with the early-stopped, less accurate
  `5.372281311118…`.

Why mathjs's `norm` returns the wrong value: `_matrixNormTwo` in
`node_modules/mathjs/lib/esm/function/arithmetic/norm.js` does
`eigs(ctranspose(x)·x).values` and reads **`values[values.length - 1]`** as the
largest eigenvalue. mathjs's BigNumber `eigs` sorts with the raw `<` operator
(`realSymmetric.js` `sorting`: `abs(E[j]) < abs(minE)`), and a mathjs BigNumber
compares as a **string** (`bignumber(16) < bignumber(9)` is `true`, i.e.
`'16' < '9'`). So `eigs(diag(9,16))` returns `[16, 9]`, `values[length-1]` is
`9`, and `norm(diag(3,4))` returns `3` instead of `4`. (Verified directly:
`mathjs.norm([[3,0],[0,4]] bignumber) === 3`; `compat` returns the correct `4`.)

**Consequence:** the oracle's own BigNumber `schur` is _incorrectly stopped_
because of a mathjs `eigs`/`norm` bug for BigNumbers. Compat reaches the correct
answer. So "mathjs and compat differ in the last digits due to decimal
precision" is not the explanation; compat simply takes the extra iterations
mathjs's buggy norm skips. Matching the oracle digit-for-digit would require
reproducing mathjs's `eigs` BigNumber mis-sort inside the compat `norm` (or at
least inside the schur stopping rule), i.e. a documented intentional gap, not a
"decimal backend" difference.

**Not a regression of `eigs`/`norm`** — `git diff main...HEAD` shows G05 touches
neither; the divergence is a latent consequence of the existing BigNumber
`eigs` ordering that G05's `schur` now relies on.

**Also see F3:** the same early stop makes 3x3+ BigNumber `sylvester`/`lyap`
diverge from the oracle at precision 14.

**Fix direction (compat-only):** make the schur stopping rule reproduce the
oracle. Either compute the step norm the way mathjs does (a `norm` that reads
the mis-sorted BigNumber eigenvalues), or replace the convergence test with a
criterion that stops at the same iterate the oracle stops at. Either way, stop
documenting the difference as "decimal precision".

---

## F2 (P2) — `schur` of a native `DenseMatrix` takes the native Francis-QR path

`needsNativePath(x)` in `compat/src/mathjs-parity-g05.ts` returns true for
`isDenseMatrix(x) || isSparseMatrix(x)` of `@danielsimonjr/mathts-matrix`, and
`compatMathjsSchur` delegates to `mathFunctions.schur(X)` for those:

```
if (isNativeDense) return mathFunctions.schur(X);
```

`create(all).matrix` returns a `MathJSDenseMatrix` (compat's own class), **not**
a `@danielsimonjr/mathts-matrix` `DenseMatrix`, so the ordinary
`evaluate('schur(...)')` and `create(all).schur(create(all).matrix(...))` paths
are fine (verified: identical to the oracle). But a caller who passes a **native**
`DenseMatrix` gets the native Francis double-shift decomposition instead of the
mathjs QR iteration:

```
mathjs schur([[1,2],[3,4]])           T = [[5.372…, -1], [5.147e-118, -0.372…]]
compat schur(native DenseMatrix)      T = [[-0.372…, -1], [0, 5.372…]]   ← native path
```

Diagonal order reversed, subdiagonal flushed to `0`. This contradicts the
commit's "Public native DenseMatrix/SparseMatrix inputs keep the native factory
path" framing as if it were parity-neutral: it is a behavioral difference on the
public `schur` name. `mathjs.schur(nativeDenseMatrix)` itself **throws**
(`isMatrix` is false for a native matrix), so there is no oracle behavior to
match for a native input — but the compat instance accepting it and silently
returning a different decomposition is a footgun. Either convert a native dense
matrix to raw data and run the mathjs iteration, or document that a native
`DenseMatrix` argument deliberately takes the native path.

(SparseMatrix is less severe: mathjs throws `qr not implemented for sparse
matrices yet` and compat throws the same, so that branch matches.)

---

## F3 (P1, dependent on F1) — BigNumber `sylvester`/`lyap` 3x3+ differ from the oracle

Because `sylvester` and `lyap` are wired to `compatMathjsSchur` (F1), a BigNumber
system of size 3x3 or larger inherits the wrong stopping iterate and diverges
from the oracle at precision 14:

- `lyap(A, Q)` with `A = [[-1,2,0],[0,-3,1],[0,0,-5]]`, `Q = I₃`:
  oracle `[[0.67292077378953, …]]`, compat `[[0.67291666667443, …]]` — differs in
  the 6th digit.
- `sylvester(A, B, C)` 4x4: differs in the 6th–7th digit.

Interesting detail: on these systems **compat is more accurate than the oracle**
(I verified against a 9×9 Kronecker `lusolve`: compat residual `2.9e-11`,
mathjs residual `1.5e-5`). So again the oracle is the "wrong" one, but the parity
contract is agreement with mathjs, and the harness rule fails.

The 2x2 doc examples (`sylvester([[-1,-2],[1,1]], …)`, `lyap([[-2,0],[1,-4]], …)`)
do match — which is why the builder's three `known-gaps` removals pass. The
removals are only correct for those exact 2x2 cases; 3x3+ BigNumber systems are
uncovered and diverge.

---

## F4 (P2) — Complex `schur` keeps a `-1.0000000000000002i` diagonal residue

`schur([[complex(1,1), complex(2,0)], [complex(0,0), complex(3,-1)]])`:

```
mathjs T = [[1 + i, 1.9717866740689 + 0.33474962578648i], [0, 3 - i]]
compat T = [[1 + i, 1.9717866740689 + 0.33474962578647i], [0, 3 - 1i]]
```

The `3 - i` diagonal entry comes out as `3 - 1.0000000000000002i` on compat (a
float round-trip in the QR accumulation), and the `T[0][1]` entry differs in the
14th digit. This is the same class as F1 but for Complex: the QR iterates diverge
from the first step because compat's QR for Complex is not bit-identical to
mathjs's. Precision-14 parity fails. Either match mathjs's Complex QR more
closely or record a known gap.

---

## Policy check — PASS

`git diff main...HEAD --name-only` touches only:

```
.changeset/g05-matrix-parity.md
changelog-fragments/2026-11-26-g05-matrix-parity.md
compat/src/index.ts
compat/src/instance-api.ts
compat/src/mathjs-parity-g05.ts
compat/tests/parity/g05-bignumber-matrix.test.ts
compat/tests/parity/g05-schur-ode.test.ts
compat/tests/parity/known-gaps/1589.json
compat/tests/parity/known-gaps/unassigned.json
docs/api/compat.md
tools/test/bundle-budget.json
```

No critical library (`typed-function`, `core`, `matrix`, `functions`,
`workpool`, `gpu`, `parallel`) is touched. Confirmed with
`git diff --name-only main...HEAD | grep -E '^(typed-function|core|matrix|functions|workpool|gpu|parallel)/'`
→ empty.

## Hygiene — mostly PASS

- No `as never`, `any`, `@ts-ignore`, `@ts-expect-error` in
  `compat/src/mathjs-parity-g05.ts` or the two G05 test files.
- Lint (`oxlint --deny-warnings`) and `prettier --check` clean on the changed
  files.
- Changelog fragment present (`changelog-fragments/2026-11-26-g05-matrix-parity.md`);
  root `CHANGELOG.md` untouched.
- Bundle budget: `compat/dist/index.js` 458,752 → 466,944 bytes (+8 KB) and the
  `create(all)` cap 2,129,920 → 2,162,688 (+32 KB). The new module is bundled
  eagerly (not lazy-loaded); the increase is within the raised cap. Worth
  flagging that growing the `create(all)` budget for four compat-only adapters
  is a real cost, and a lazy `import()` would avoid it, but it is not a
  correctness defect.

## Known-gaps removals — correct only for the exact 2x2 cases

The five removed labels all now match the oracle **for those exact expressions**
(verified). They do not cover 3x3+ BigNumber systems (F3), so the removals are
not wrong, just incomplete.

---

## What passed (no defect)

- Policy: no critical library touched.
- `pow` of BigNumber matrices, exponents `0/1/2/3/-1`, under `{}`,
  `{number:'BigNumber'}`, `{matrix:'Array'}`, `{number:'BigNumber',matrix:'Array'}`,
  both direct calls and `evaluate(...)`: values, `typeOf`, and entry types all
  match the oracle.
- `schur` of number matrices (2x2/3x3/4x4, symmetric and non-symmetric, 1x1,
  empty `[]`/`[[]]`) via array, `create(all).matrix(...)`, and `evaluate(...)`:
  bit-identical, subdiagonal residue `5.147e-116`-class preserved.
- `solveODE` across scalar/vector, RK23/RK45, `tol`/`minStep`/`maxStep`/
  `firstStep`/`minDelta`/`maxDelta`/`maxIter`, backward integration, BigNumber,
  Matrix `tspan`/`y0`, invalid tspan, arity errors: all match. Two divergences
  found are pre-existing and not G05's (see below).
- Removed `known-gaps` labels: all five now match the oracle.

## Additional (pre-existing, NOT attributable to G05) divergences observed

These are **not** counted as G05 defects; recorded for the reviewer.

- Singular BigNumber `pow(A, -1)` / `inv`: mathjs returns `[[NaN, NaN], …]`
  (its `inv` does not throw for a singular BigNumber matrix), compat throws
  `Cannot calculate inverse, determinant is zero`. `inv`/`pow` are untouched by
  G05 (`git diff` empty for them).
- `pow(nonSquare)` throws `RangeError` on mathjs vs `Error` on compat — the
  message is identical; only the constructor differs (pre-existing `multiply`
  path).
- `solveODE` with a Unit `tspan` (e.g. `[unit('0 s'), unit('1 s')]`): the error
  wording differs (`addScalar … actual: Unit` vs `Too few arguments in function
add`) but both throw on both sides; a Unit `y0` with number `tspan` matches.
- `solveODE` 2-arg arity error lists the union type in a different order
  (`number or BigNumber or Unit or Array …` vs `number or Array or BigNumber or
Unit …`); same error, order only.
