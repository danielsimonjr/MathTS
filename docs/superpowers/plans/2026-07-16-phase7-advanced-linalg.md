# Phase 7 — Advanced Linear Algebra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Add the large-scale / structured / matrix-function linear algebra MathTS lacks — iterative Krylov solvers, an iterative eigensolver, structured & indefinite solvers, complex matrix functions, and control-theory matrix equations — all in the `functions` package (accepting dense `number[][]` or a matvec callback), oracle-pinned vs scipy.

**Tech Stack:** TypeScript (ESM, strict), Vitest. Oracles: scipy 1.17.1, numpy 2.3.4.

## Global Constraints

- Tests import built `dist/` — rebuild before vitest.
- **Oracle-pinned** to scipy/closed forms (given below or verified at build time). Never round-trip.
- No new cross-package deps. Building blocks in `functions`: `schur`/`qz` (reachable), `lusolve`/`linsolve`/`inv`, `norm2`, `Complex` (from core), `sylvester`/`lyap`, `qr`. Import from source modules.
- Implement solvers to accept **either a dense `number[][]` OR a matvec function `(x: number[]) => number[]`** (LinearOperator style) so they work for sparse/large problems too.
- Additive & non-breaking (name new eigensolver `eigsh`, not `eigs` — `eigs` is the existing dense all-eigenvalue routine). strict + eslint zero. **New public exports → curated `docs/reference/functions.md` table** (docs-completeness gate) + `npm run docs:functions`/`docs:deps`.
- Commit footer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- git hook slow (~540000ms; commit may need explicit long timeout). Implementers commit locally, do NOT push.

## Verified current state

Missing: `cg`/`gmres`/`bicgstab`/`minres`, `eigsh`, `cosm`/`sinm`/`funm`, `ldl`, `dlyap`/`care`/`dare`, `solveBanded`/`thomasSolve`/`toeplitzSolve`, `rq`/`ql`/`lq`. Present: `eigs` (dense), `sqrtm`/`matrixLogm` (real/pos-eig only), `sylvester`/`lyap`, `schur`/`qz`, `qr`, `lusolve`.

---

### Task 1: iterative Krylov solvers — `cg`/`gmres`/`bicgstab`/`minres` + Jacobi preconditioner

**Files:** `functions/src/numeric/krylov.ts` (new); export `cg`, `gmres`, `bicgstab`, `minres`. Test `functions/tests/krylov.test.ts`.

**Spec:** each solver signature `solver(A: number[][] | ((x: number[]) => number[]), b: number[], opts?: { x0?; tol?; maxIter?; preconditioner?: 'jacobi' | ((r) => number[]) }): { x: number[]; iterations: number; converged: boolean; residual: number }`.

- `cg` — conjugate gradient (symmetric positive-definite). `minres` — minimum residual (symmetric indefinite). `gmres` — generalized minimal residual (general, with restart, default restart 30). `bicgstab` — biconjugate gradient stabilized (general nonsymmetric).
- Accept `A` as a dense matrix (build matvec = A·x) or a matvec function directly.
- Jacobi preconditioner: `M⁻¹ = diag(1/A_ii)` — only available when `A` is a dense matrix (need the diagonal).
- Converge on `‖b − A x‖ / ‖b‖ < tol` (default 1e-10, maxIter = min(n·10, 1000)).

**Oracle (VERIFIED):** `cg([[4,1],[1,3]], [1,2])` → `[1/11, 7/11]` = `[0.09090909, 0.63636364]`.

- [ ] **Step 1: failing test** `functions/tests/krylov.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cg, gmres, bicgstab, minres } from '../src/index.js';

const A = [
  [4, 1],
  [1, 3],
];
const b = [1, 2];
const expected = [1 / 11, 7 / 11];

describe('Krylov solvers', () => {
  it('cg solves SPD [[4,1],[1,3]]x=[1,2] -> [1/11, 7/11]', () => {
    const r = cg(A, b);
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
    expect(r.x[1]).toBeCloseTo(expected[1], 8);
    expect(r.converged).toBe(true);
  });
  it('gmres and bicgstab solve a nonsymmetric system', () => {
    const N = [
        [3, 1],
        [0, 2],
      ],
      c = [4, 2];
    for (const solver of [gmres, bicgstab]) {
      const r = solver(N, c);
      // exact: x=[1,1]
      expect(r.x[0]).toBeCloseTo(1, 6);
      expect(r.x[1]).toBeCloseTo(1, 6);
    }
  });
  it('minres solves a symmetric indefinite system', () => {
    const r = minres(
      [
        [0, 1],
        [1, 0],
      ],
      [1, 2]
    ); // x=[2,1]
    expect(r.x[0]).toBeCloseTo(2, 6);
    expect(r.x[1]).toBeCloseTo(1, 6);
  });
  it('cg accepts a matvec function', () => {
    const matvec = (x: number[]) => [4 * x[0] + x[1], x[0] + 3 * x[1]];
    const r = cg(matvec, b);
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
  });
  it('cg with Jacobi preconditioner converges', () => {
    const r = cg(A, b, { preconditioner: 'jacobi' });
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
  });
});
```

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(linalg): Krylov solvers cg/gmres/bicgstab/minres`).

---

### Task 2: iterative eigensolver — `eigsh` (Lanczos, k eigenpairs)

**Files:** `functions/src/numeric/eigsh.ts` (new); export `eigsh`. Test `functions/tests/eigsh.test.ts`.

**Spec:** `eigsh(A: number[][] | ((x:number[])=>number[]), k = 1, opts?: { which?: 'LM' | 'SM'; n?: number; tol?; maxIter? }): { eigenvalues: number[]; eigenvectors: number[][] }` — the k largest ('LM', default) or smallest-magnitude ('SM') eigenpairs of a **symmetric** matrix via the **Lanczos** iteration (build a tridiagonal Krylov basis, solve its small eigenproblem, Rayleigh–Ritz). Accept a dense matrix or a matvec (for matvec, require `opts.n` = dimension). Eigenvectors returned as columns (or rows — document); orthonormal.

**Oracle (VERIFIED):** largest eigenvalue of tridiag `[[2,1,0],[1,2,1],[0,1,2]]` = `2 + √2` = `3.41421356`; smallest = `2 − √2` = `0.58578644`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { eigsh } from '../src/index.js';

const T = [
  [2, 1, 0],
  [1, 2, 1],
  [0, 1, 2],
];

describe('eigsh (Lanczos, k eigenpairs)', () => {
  it('largest eigenvalue of tridiag = 2+sqrt(2)', () => {
    const r = eigsh(T, 1, { which: 'LM' });
    expect(r.eigenvalues[0]).toBeCloseTo(2 + Math.SQRT2, 6);
  });
  it('smallest eigenvalue = 2-sqrt(2)', () => {
    const r = eigsh(T, 1, { which: 'SM' });
    expect(r.eigenvalues[0]).toBeCloseTo(2 - Math.SQRT2, 6);
  });
  it('eigenpair satisfies A v = lambda v', () => {
    const r = eigsh(T, 1, { which: 'LM' });
    const v = r.eigenvectors.map((row) => row[0]); // first eigenvector (column)
    const Av = T.map((rw) => rw.reduce((s, a, j) => s + a * v[j], 0));
    Av.forEach((val, i) => expect(val).toBeCloseTo(r.eigenvalues[0] * v[i], 5));
  });
});
```

(Adjust eigenvector indexing to your column/row convention.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(linalg): eigsh iterative symmetric eigensolver (Lanczos)`).

---

### Task 3: structured & indefinite solvers — `thomasSolve`/`solveBanded`/`toeplitzSolve`/`ldl`

**Files:** `functions/src/numeric/structured-solvers.ts` (new); export `thomasSolve`, `solveBanded`, `toeplitzSolve`, `ldl`. Test `functions/tests/structured-solvers.test.ts`.

**Spec:**

- `thomasSolve(sub: number[], diag: number[], sup: number[], d: number[]): number[]` — tridiagonal solve (Thomas algorithm). `sub` = subdiagonal (length n−1), `diag` (n), `sup` = superdiagonal (n−1), `d` = RHS.
- `solveBanded(l: number, u: number, ab: number[][], b: number[]): number[]` — banded solve with `l` lower + `u` upper diagonals (ab in scipy's banded storage, or accept the full matrix + bandwidths — pick one and document; simplest: accept the dense banded matrix `A` and bandwidths, do banded LU).
- `toeplitzSolve(c: number[], r: number[], b: number[]): number[]` — solve a Toeplitz system (first column `c`, first row `r`) via the **Levinson–Durbin** recursion.
- `ldl(A: number[][]): { L: number[][]; D: number[][]; perm: number[] }` — LDLᵀ factorization of a symmetric (possibly indefinite) matrix via Bunch–Kaufman pivoting; `A[perm][:,perm] = L·D·Lᵀ`.

**Oracles:** `thomasSolve` of a tridiag system vs `numpy.linalg.solve`; `toeplitzSolve` vs `scipy.linalg.solve_toeplitz`; `ldl` reconstruct `L·D·Lᵀ` ≈ permuted A (and vs `scipy.linalg.ldl`). Verify at build time.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { thomasSolve, toeplitzSolve, ldl } from '../src/index.js';

describe('structured & indefinite solvers', () => {
  it('thomasSolve tridiagonal matches dense solve', () => {
    // [[2,-1,0],[-1,2,-1],[0,-1,2]] x = [1,0,1] -> x=[1,1,1]
    const x = thomasSolve([-1, -1], [2, 2, 2], [-1, -1], [1, 0, 1]);
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[1]).toBeCloseTo(1, 8);
    expect(x[2]).toBeCloseTo(1, 8);
  });
  it('toeplitzSolve matches scipy solve_toeplitz', () => {
    // T with c=r=[2,1] (2x2 [[2,1],[1,2]]) , b=[1,2] -> x=[0,1]
    const x = toeplitzSolve([2, 1], [2, 1], [1, 2]);
    expect(x[0]).toBeCloseTo(0, 6);
    expect(x[1]).toBeCloseTo(1, 6);
  });
  it('ldl reconstructs L D L^T (symmetric indefinite)', () => {
    const A = [
      [0, 1],
      [1, 0],
    ]; // indefinite
    const { L, D, perm } = ldl(A);
    // reconstruct P A P^T = L D L^T
    const n = 2;
    const LD = L.map((row) => D[0].map((_, j) => row.reduce((s, lik, k) => s + lik * D[k][j], 0)));
    const rec = LD.map((row, i) => L.map((lrow) => row.reduce((s, v, k) => s + v * lrow[k], 0)));
    const PAPt = perm.map((pi) => perm.map((pj) => A[pi][pj]));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) expect(rec[i][j]).toBeCloseTo(PAPt[i][j], 6);
  });
});
```

(Verify the toeplitz/ldl oracles vs scipy before finalizing; adjust the ldl reconstruction to your returned convention.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(linalg): structured solvers thomasSolve/solveBanded/toeplitzSolve + ldl`).

---

### Task 4: complex matrix functions — `funm`/`cosm`/`sinm` (Schur–Parlett)

**Files:** `functions/src/numeric/matrix-functions.ts` (new); export `funm`, `cosm`, `sinm`. Test `functions/tests/matrix-functions.test.ts`.

**Spec:** `funm(A: number[][], f: (z: {re:number; im:number}) => {re:number; im:number}): { re: number[][]; im: number[][] }` — evaluate the matrix function f(A) via the **Schur–Parlett** algorithm: compute the (complex) Schur form `A = Q T Qᴴ` (use the existing `schur` — import from source; if it returns a real quasi-triangular form, handle 2×2 blocks or convert to complex Schur), apply f to the diagonal, fill the upper triangle by the Parlett recurrence, transform back. Returns a complex matrix `{re, im}`.

- `cosm(A) = funm(A, cos)`, `sinm(A) = funm(A, sin)` (complex cos/sin). Use core `Complex` for the scalar f on the diagonal.

**Oracles (scipy, VERIFIED):** `cosm([[0,1],[-1,0]])` = `diag(cosh(1))` = `diag(1.5430806)` (real part; imag ≈ 0). `funm(diag(-4,-9), sqrt)` = `diag(2i, 3i)` (imag parts 2 and 3).

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { funm, cosm, sinm } from '../src/index.js';

describe('complex matrix functions (Schur-Parlett)', () => {
  it('cosm([[0,1],[-1,0]]) = diag(cosh 1)', () => {
    const C = cosm([
      [0, 1],
      [-1, 0],
    ]);
    expect(C.re[0][0]).toBeCloseTo(1.5430806348, 6);
    expect(C.re[1][1]).toBeCloseTo(1.5430806348, 6);
    expect(C.re[0][1]).toBeCloseTo(0, 6);
  });
  it('funm(diag(-4,-9), sqrt) = diag(2i, 3i)', () => {
    const S = funm(
      [
        [-4, 0],
        [0, -9],
      ],
      (z) => {
        // complex sqrt
        const r = Math.hypot(z.re, z.im),
          a = Math.atan2(z.im, z.re) / 2,
          m = Math.sqrt(r);
        return { re: m * Math.cos(a), im: m * Math.sin(a) };
      }
    );
    expect(S.im[0][0]).toBeCloseTo(2, 6);
    expect(S.im[1][1]).toBeCloseTo(3, 6);
  });
  it('sinm(0 matrix) = 0', () => {
    const S = sinm([
      [0, 0],
      [0, 0],
    ]);
    expect(S.re[0][0]).toBeCloseTo(0, 8);
  });
});
```

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(linalg): funm/cosm/sinm complex matrix functions (Schur-Parlett)`).

---

### Task 5: control-theory matrix equations — `dlyap`/`care`/`dare`

**Files:** `functions/src/numeric/control-equations.ts` (new); export `dlyap`, `care`, `dare`. Test `functions/tests/control-equations.test.ts`.

**Spec:**

- `dlyap(A, Q): number[][]` — discrete Lyapunov `A X Aᵀ − X + Q = 0` (solve via the Kronecker linear system `(I − A⊗A) vec(X) = vec(Q)` using `linsolve`, or a Bartels–Stewart/Schur approach).
- `care(A, B, Q, R): number[][]` — continuous algebraic Riccati `AᵀX + XA − X B R⁻¹ Bᵀ X + Q = 0` via the **Hamiltonian matrix** `H = [[A, −BR⁻¹Bᵀ], [−Q, −Aᵀ]]`: compute its stable invariant subspace (eigenvectors for eigenvalues with negative real part, via `eig`/`schur`), `X = U21 U11⁻¹`.
- `dare(A, B, Q, R): number[][]` — discrete Riccati via the symplectic pencil / generalized eigenproblem (use `qz`).

**Oracle (scipy, VERIFIED):** `care([[0,1],[0,0]], [[0],[1]], I₂, [[1]])` → `X = [[√3, 1], [1, √3]]` = `[[1.7320508, 1], [1, 1.7320508]]`.

- [ ] **Step 1: failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { care, dlyap } from '../src/index.js';

describe('control-theory matrix equations', () => {
  it('care double-integrator -> [[sqrt3,1],[1,sqrt3]]', () => {
    const X = care(
      [
        [0, 1],
        [0, 0],
      ],
      [[0], [1]],
      [
        [1, 0],
        [0, 1],
      ],
      [[1]]
    );
    expect(X[0][0]).toBeCloseTo(Math.sqrt(3), 5);
    expect(X[0][1]).toBeCloseTo(1, 5);
    expect(X[1][1]).toBeCloseTo(Math.sqrt(3), 5);
  });
  it('dlyap solves A X A^T - X + Q = 0', () => {
    // A=diag(0.5,0.5), Q=I -> X = 1/(1-0.25) I = 4/3 I
    const X = dlyap(
      [
        [0.5, 0],
        [0, 0.5],
      ],
      [
        [1, 0],
        [0, 1],
      ]
    );
    expect(X[0][0]).toBeCloseTo(4 / 3, 6);
    expect(X[1][1]).toBeCloseTo(4 / 3, 6);
    expect(X[0][1]).toBeCloseTo(0, 6);
  });
});
```

(Verify care/dare against scipy at build time; if the full Hamiltonian eigenvector approach is fiddly for `care`, an iterative Newton/sign-function method that reaches the scipy answer is acceptable — pin to the scipy value regardless of method.)

- [ ] Steps 2–5 (docs-completeness; CHANGELOG `### Added`; commit `feat(linalg): dlyap/care/dare control-theory matrix equations`).

---

## Release (after all 5 tasks green)

- [ ] `npx changeset` → **minor** `@danielsimonjr/mathts-functions`. Summarize the advanced-linalg additions.
- [ ] version → build → full `functions` suite + monorepo typecheck + eslint green.
- [ ] commit, push, `changeset publish` (wait for propagation), push tags, **verify** via `npm view` + clean-install probe of `cg`/`eigsh`/`toeplitzSolve`/`cosm`/`care`.
- [ ] Tick TODO Phase 7; footnote roadmap; phase-boundary check-in; then Phase 8.

**Deferred to a Phase-7 extension (logged in TODO):** rank-revealing QR (`qr` pivoting) + `rq`/`ql`/`lq`; `generalizedEig` QZ-hardening; sparse `svds`; preconditioners beyond Jacobi (ILU/IC); `condest`.

## Self-Review

- New eigensolver is `eigsh` (not `eigs` — that exists). Krylov/eigsh accept dense or matvec.
- Task 4 modifies nothing existing (funm/cosm/sinm are new; existing sqrtm/logm untouched — indefinite sqrtm is now reachable via `funm`). Oracle-pinned to scipy.
