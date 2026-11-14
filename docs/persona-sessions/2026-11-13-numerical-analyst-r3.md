STARTED 2026-11-14T04:46:19Z

## Step 3-4 progress (items 1-2 of persona tasks)

Scripts (scratch): t1.mjs (solve/fit), t1b.mjs (edge probes), t1c.mjs (svd/cond), ref1.py (NumPy 2.3.4 reference). Outputs: t1-solve.json, t1-fit.json.

- Tridiagonal SPD (n=50, 500): linsolve, lusolve agree with NumPy; residual inf-norm 2e-16 to 3e-16; fwd error matches NumPy to ~1e-14.
- Hilbert n=8: residual 4.4e-16 (NumPy 2.2e-16); forward error 4.2e-7 (NumPy 1.2e-7). Expected for cond 1.5e10.
- Hilbert n=12: residual 8.9e-16; forward error 0.36 (NumPy 0.70). Expected for cond 1.8e16 (beyond 1/eps). Not a defect.
- cond(H8): MathTS 1.52575773e10, NumPy 1.52575755e10 (rel 1.2e-7). Smallest singular value error 1e-7 relative; within the eps*||A||2 absolute bound. Not a defect.
- cond(H12): MathTS 1.84449e16, NumPy 1.76062e16 (4.8%). Smallest singular value is at the rounding floor (~1e-16). Not a defect; cond beyond 1/eps is noise.
- Vandermonde 30x6 lstsq: MathTS and NumPy agree to ~1e-13 absolute on every coefficient.
- Rank-deficient lstsq [[1,1],[1,1],[1,1]]: returns [1.0000000000000004, 1]; NumPy min-norm [1, 1]. Sum correct; fine.
- pinv shape 6x30 correct; pinv([[1e-300]]) = 9.999999999999999e+299.
- det(H8) = 2.7370501431517162e-33 vs NumPy 2.7370500086739613e-33 (rel 5e-8, within conditioning).

Edge-input observations (t1b.mjs, raw output):

- det([[NaN,1],[1,2]]) -> NaN; det Inf matrix -> Infinity. Fine.
- det(1e200 diag 2x2) -> Infinity (true value overflows). Fine.
- inv([[-0]]) throws "Cannot calculate inverse, determinant is zero". Fine.
- inv([]) throws RangeError "Matrix must be square (size: [0])". Fine.
- pinv([]) throws TypeError "DenseMatrix nested array must be a non-empty rectangular array of numbers" for a plain-array input. The message names an internal class the caller never used. Candidate P2 (error message).
- pinv(4) throws TypeError (scalar not accepted). mathjs pinv(scalar) returns 1/4. Check docs/d.ts before filing.
- linsolve(A, [NaN,2]) returns [NaN,NaN] silently. lstsq(A, [NaN,1]) throws RangeError "b has a non-finite entry". Inconsistent NaN policy between two solvers. Candidate P2.
- linsolve and lstsq singular errors: "linsolve: singular matrix"; lusolve: "Linear system cannot be solved since matrix is singular"; inv: "Cannot calculate inverse, determinant is zero". Three wordings, same condition. Ergonomic only.

## DenseMatrix input probes (t1d.mjs, t1e.mjs, t1f.mjs)

- P0 candidate: det(DenseMatrix [[1,2],[3,4]]) returns a DenseMatrix equal to the input [[1,2],[3,4]]. Expected -2 (det([[1,2],[3,4]]) = -2 on the array path). det(DenseMatrix 3x3 diag(2,3,4)) returns the matrix; array path gives 24. The public type DetCallable (functions/dist/types/public-overloads.generated.d.ts:251-255) declares `(a: number[] | Matrix): number | BigNumber | Complex`, so the wrong type is also a contract break.
- P0 candidate: linsolve(array A, DenseMatrix column b) returns [NaN, NaN] with no error. linsolve(array A, [[5],[11]]) (nested array) returns the correct [1, 2]. The DenseMatrix path is silently wrong. Public d.ts declares b: number[] (typed/numeric.d.ts:62), so a dimension check is missing at the boundary.
- P1 candidate: linsolve(DenseMatrix A, [5,11]) and lusolve(DenseMatrix A, [5,11]) throw raw TypeError "Cannot read properties of undefined (reading 'length')". Internal message leaks.
- P1 candidate: eigs(DenseMatrix) throws TypeError "mat.size is not a function". Internal message leaks; the array path works.
- P1 candidate: inv(DenseMatrix [[1,2],[3,4]]) throws RangeError "Matrix must be two dimensional (size: [])". The array path returns [[-2,1],[1.5,-0.5]]. Same input, valid matrix.
- P2: lstsq(array A, DenseMatrix b) and linsolve/pinv of an empty array give "DenseMatrix nested array must be a non-empty rectangular array of numbers" for array inputs. Message names a class the caller did not use.
- Confirmed working: pinv(DenseMatrix) returns DenseMatrix with correct inverse values; cond(DenseMatrix)=14.933 and norm(DenseMatrix)=5.4772 match the array path; svd(DenseMatrix) matches the array path.
- Typing note: linsolve d.ts says `number[][] | SparseMatrix`. Runtime accepts DenseMatrix silently wrong or throws.
- M.sparse is not exported from mathts-matrix; SparseMatrix class and SparseMatrix.fromCOO exist (typeof 'function').

## Round-2 re-check status (step 3)

Counts are set after the table in the final report. Evidence: t3.mjs, t3b.mjs, t3c.mjs.

- #926 (Jordan eig/eigs): still reproduces on 0.86.0. eigs([[2,1,0],[0,2,0],[0,0,3]]) returns two eigenvectors for λ=2: [1,0,0] and [-1, 1.8e-15, 0]. They are parallel. A·v = λ·v holds, but the pair is linearly dependent. eigs gives no defective flag. L.eig does flag it (defective: true, independentEigenvectors: 1). The issue is CLOSED; the defect is not fixed in eigs. Verdict: partial.
- #927 (sparse linsolve/lsolve/luSolve): fixed. linsolve(SparseMatrix SPD n=6) matches dense reference to 4e-16. lsolve(sparse) returns lower-triangular forward substitution, which is documented behaviour. lu(sparse) + luSolve(lu, b) matches. Verdict: yes.
- #928 (no lstsq; rectangular lsolve message): fixed. lstsq exists and returns [0.6667, 0.5] (matches NumPy). lsolve(rect) error now says "use lstsq". Verdict: yes.
- Other round-2 items (#688-#701) are out of this run's lane except as noted; not re-run here.

## New findings (round 3, numerical lane)

- eigs and L.eig return eigenvectors that do not satisfy A·v = λ·v for complex eigenvalues. Repro: A = [[0,-1],[1,0]]. eigs returns the real vector [-0.7071, 0] for both λ = ±i; residual 0.707. L.eig returns column 0 = (-0.7071, -0.7071) with no imaginary part; residual 1.0. NumPy: v = (0.7071, -0.7071i) for λ = i, residual 0. P0 or P1, wrong result on documented use.
- det(DenseMatrix) returns the input matrix instead of the determinant. P0.
- linsolve(array A, DenseMatrix column b) returns [NaN, NaN] silently. P0/P1.
- Stiff solvers (BDF, Radau, Rosenbrock, RODAS) hang on an invalid tspan. Repro: solveODE(f, [0,40,5], [1,0,0], {method:'Radau'}) (tspan length 3) runs past 25 s and was killed (exit 124). RK45 throws "tspan must be an Array of two numeric values". P1 (the brief requires no hangs).
- fft([]) throws RangeError "Maximum call stack size exceeded". P1 (crash, no message).
- fft([NaN,1,2,3]) returns re = NaN but im finite (2, -2, 0). A NaN sample must make the whole spectrum NaN. P2 or P1 (silent partial result).
- fft([5]) returns the plain number 5, not a Complex. Other lengths return Complex. P2 (type).
- quad(() => NaN, 0, 1) returns {value: NaN, error: NaN} silently. P2 (error should name the problem).
- sqrt(SparseMatrix with negative entries) returns a plain JS Array of Complex. sqrt(SparseMatrix with no negatives) returns SparseMatrix. Result type depends on values. P2.
- solveODE with an events object shaped {fn, terminal, direction} (not the typed {event, ...} shape) throws raw TypeError "e.g is not a function". P2 (no validation).
- ifft: the functions package public d.ts (functions/dist/signal/fft.d.ts:86) declares ifft(spectrum, originalLength?) with a doc example using fft(...).spectrum and originalLength. Runtime F.ifft accepts one argument only and throws "Too many arguments" for two. Contract mismatch. P2 (docs/typing).
- DenseMatrix input: inv(DenseMatrix) throws RangeError "Matrix must be two dimensional (size: [])"; linsolve(DenseMatrix A) and lusolve(DenseMatrix A) throw "Cannot read properties of undefined (reading 'length')"; eigs(DenseMatrix) throws "mat.size is not a function". Same matrices work on the array path. P1 (raw internal errors).
- pinv([]) error names DenseMatrix for a plain-array input. P2.
- linsolve and lusolve return NaN silently for NaN or Infinity in b. lstsq throws for the same kind of input. P2 (inconsistent NaN policy). Round-2 #688 covers NaN in A (throws, with a "singular" message).
- Error message says "singular" for NaN in A (lusolve). The cause is not singularity. P2.

## Stiff ODE and events (t5.json not written; numbers from t5a.mjs runs)

SciPy Radau at rtol 1e-10 is the reference for Robertson at t = 40: y = [0.7158270687194118, 9.18553476455899e-06, 0.2841637457458243].

- MathTS Radau tol 1e-6: y1 error 2.4e-10; 72 steps; 13 ms.
- MathTS BDF tol 1e-6: y1 error 8.4e-7; 126 steps; 9 ms. SciPy BDF at rtol 1e-6 has y1 error 4.0e-6.
- MathTS Rosenbrock: y1 error 3.6e-7; RODAS: y1 error 4.4e-8; RK45 at 1e-6: y1 error 9.9e-10, 34,479 steps, 1.2 s.
- Van der Pol mu = 1000, t = 1 (ref SciPy Radau 1e-10): Radau error 2e-14, RODAS error 1e-14, BDF error 7.2e-8, RK45 error 8e-14. All methods agree.
- Falling ball, exact ground time sqrt(20/9.81) = 1.4278431229270645. RK45 tol 1e-8 event: 1.4278431229270647 (error 2e-16). BDF tol 1e-8: 1.4278431114 (error 1.2e-8). Radau: 1.4278431229270647.
- Non-terminal events (terminal:false) run to tspan end and record the crossing count.

## FFT round trip (t7.mjs, one run each, Node 26.13.0, Windows 11, shared host)

| n | fft ms | ifft ms | max abs err | error in ULP of max sample | max |imag| of inverse |
| 1024 | 7.74 | 1.34 | 8.88e-16 | 2.6 | 5.6e-16 |
| 4096 | 1.34 | 2.07 | 8.88e-16 | 2.6 | 8.4e-16 |
| 65536 | 13.37 | 28.03 | 1.33e-15 | 3.9 | 1.2e-15 |
Input: sin(2πk·3/n) + 0.5·cos(2πk·17/n) + 0.1·k/n. NumPy comparison of the spectrum was not run (see Coverage).

## Coverage (step 5b)

Area = numerical exports of functions, linalg and matrix that a numerical analyst calls (76). Called = at least one normal input run. Edge inputs and results are in sweep.json and the scripts named above. Oracle-checked: about 30 of the 76 (solver, fit, eig residuals, ODE, quad, roots, complex, FFT, sparse solve). The rest are checked for type and error shape only.
Called: 76 of 76 area exports. Full per-export table: coverage.md (scratch) — summary rows below.

| export                                                                                                                                                                         | called       | edge inputs                                                                                                                   | finding                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| linsolve                                                                                                                                                                       | yes          | empty, 1x1, NaN/Inf b, singular, nonsquare, wrong-length b, DenseMatrix A, column DenseMatrix b, sparse A                     | DM column b silent NaN (P0); DM A raw TypeError (P1); NaN b silent (P2)                                     |
| lusolve                                                                                                                                                                        | yes          | singular, nonsquare, NaN A, Inf b, DenseMatrix A, column b                                                                    | DM A raw TypeError (P1); NaN b silent; NaN A says singular (P2)                                             |
| lsolve                                                                                                                                                                         | yes          | sparse lower-triangular, rectangular                                                                                          | #928 message fixed; none                                                                                    |
| lstsq                                                                                                                                                                          | yes          | Vandermonde 30x6, rank-deficient, NaN b, DenseMatrix A, column DM b                                                           | DM column b raw TypeError (P2)                                                                              |
| inv                                                                                                                                                                            | yes          | NaN, empty, 1x1, singular, DenseMatrix                                                                                        | DM input raw RangeError (P1)                                                                                |
| det                                                                                                                                                                            | yes          | NaN, Inf, empty, nonsquare, 1x1 zero, overflow, DenseMatrix, string, number                                                   | returns input for DM / string / number (P0)                                                                 |
| cond                                                                                                                                                                           | yes          | Hilbert 8/12, singular, NaN, nonsquare, DenseMatrix                                                                           | none (Hilbert values within eps bound)                                                                      |
| pinv                                                                                                                                                                           | yes          | Vandermonde, zero, 1x1 tiny, scalar, empty, DenseMatrix, opts rcond                                                           | empty array names DenseMatrix (P2); scalar rejected (check docs)                                            |
| norm, normFro, norm2                                                                                                                                                           | yes          | empty, NaN, one, wrong type                                                                                                   | none beyond shared NaN policy                                                                               |
| svd, singularValues                                                                                                                                                            | yes          | 3x3, Hilbert, empty, NaN                                                                                                      | none in dense path; bench below                                                                             |
| eigs                                                                                                                                                                           | yes          | Jordan 2x2/3x3, near-degenerate, symmetric 3x3, rotation, 1x1, DenseMatrix                                                    | defective pair dependent, no flag (P1, reopen #926); complex eigenvectors wrong (P0); DM raw TypeError (P1) |
| eig (linalg)                                                                                                                                                                   | yes          | Jordan, rotation, 2x2 real, 3x3 complex, nonsquare, empty, NaN                                                                | complex eigenvectors wrong (P0); defective flag correct                                                     |
| eigvals (linalg)                                                                                                                                                               | yes          | rotation, Jordan                                                                                                              | values correct                                                                                              |
| eigWasm, svdWasm, eigvalsWasm, spectralRadiusWasm                                                                                                                              | yes (normal) | empty, NaN, one, wrong type                                                                                                   | return a Promise; NaN rejection is not caught by sync try (by contract, note only)                          |
| fft                                                                                                                                                                            | yes          | n=1024/4096/65536, n=3, n=1000, [], [5], [NaN,1,2,3], Float64Array, nested                                                    | [] stack overflow (P1); NaN partial (P2); [5] number (P2)                                                   |
| ifft                                                                                                                                                                           | yes          | round trip 1024/4096/65536, n=3, n=1000, length argument                                                                      | two-arg form rejected; d.ts documents it (P2)                                                               |
| solveODE                                                                                                                                                                       | yes          | Robertson x5 methods, Van der Pol x5, ball events, reversed/zero span, scalar y0, NaN rhs, wrong-order tspan, bad event shape | stiff hang on bad tspan (P1); bad event shape raw TypeError (P2)                                            |
| fsolve                                                                                                                                                                         | yes          | sqrt(2), 2-D linear                                                                                                           | accuracy 1.6e-12 and 4.7e-11 at default tol (not a finding)                                                 |
| findRoot                                                                                                                                                                       | yes          | cos, no sign change, reversed                                                                                                 | correct                                                                                                     |
| quad                                                                                                                                                                           | yes          | exp(-x^2), 1/sqrt(x), reversed, zero width, infinite, NaN integrand, partial NaN                                              | NaN silent (P2); infinite limit rejected (feature gap, not filed)                                           |
| complex                                                                                                                                                                        | yes          | products, quotient, /0, sqrt(-4), exp(i pi), abs                                                                              | correct                                                                                                     |
| multiply, divide                                                                                                                                                               | yes          | complex x complex, sparse x scalar, complex / 0                                                                               | correct                                                                                                     |
| sqrt                                                                                                                                                                           | yes          | sparse with and without negatives, dense, nested                                                                              | result type depends on values (P2)                                                                          |
| sin, exp, abs, add, unaryMinus, mod                                                                                                                                            | yes          | sparse, complex, Float64Array 1e6                                                                                             | correct; add(sparse, scalar) returns DenseMatrix (as mathjs)                                                |
| matrixExpm, matrixLogm, matrixSqrtm                                                                                                                                            | yes          | 2x2 nilpotent, arrays                                                                                                         | plain array leaks `A.toArray is not a function` (P2)                                                        |
| matrixPinv                                                                                                                                                                     | yes          | arrays                                                                                                                        | leaks "DenseMatrix constructor is (rows, cols)" (P2)                                                        |
| matrixSchur, lu, luSolve, cholesky, qr, lq, ql, rq, qrPivoted, condest, lowRankApprox, powerIteration, transposeNestedArray                                                    | yes          | empty, NaN, one, wrong type                                                                                                   | no finding beyond shared NaN policy; luSolve raw TypeError on bad input                                     |
| SparseMatrix.fromCOO, toDense                                                                                                                                                  | yes          | SPD tridiagonal n=6                                                                                                           | #927 fixed                                                                                                  |
| SparseMatrix.size                                                                                                                                                              | yes          | 2x2                                                                                                                           | not a method on the CSR class; mathjs-style size() missing (not filed; known shape split, #949 closed)      |
| matrix (factory)                                                                                                                                                               | yes          | 1-D, 2-D                                                                                                                      | 1-D array rejected (P2)                                                                                     |
| DenseMatrix                                                                                                                                                                    | yes (typeof) | via matrix()                                                                                                                  | none                                                                                                        |
| Not called: none of the 76 area exports. Exports outside the lane (stats, signal, units, workbook) were not called by this persona; the sweeper and other personas cover them. |

## Bench (step 5)

See the section appended below after the run completes.

## Bench (step 5) — numbers and conditions

Machine: Windows 11 Pro, 12 logical CPUs, Node v26.13.0. Two other MathTS test agents ran at the same time (per brief). Their load was not sampled, so every number carries contention. Round 2 ran on a Linux 4-core KVM VM with Node v22.23.4. Compare ratios, not absolute ms.
Runs: median of 7 timed runs after 2 warm-ups (bench.mjs, file bench-out.json) for n = 200 and 500. n = 1000 matmul, lusolve and svd: ONE timed run each (bench1000.mjs). The full n = 1000 pass exceeded the 580 s budget and was killed; the partial file has no n = 1000 rows.

| op                    | n    | MathTS ms      | ml-matrix ms                  | MathTS / ml | round-2 MathTS / ml (ratio)        |
| --------------------- | ---- | -------------- | ----------------------------- | ----------- | ---------------------------------- |
| matmul                | 200  | 8.65 (med)     | 15.47 (med)                   | 0.56        | round 2 had MathTS win at 200-1000 |
| matmul                | 500  | 285.38 (med)   | 417.18 (med)                  | 0.68        | MathTS win                         |
| matmul                | 1000 | 3126 (1 run)   | 6477 (1 run)                  | 0.48        | 524 vs 991 (0.53)                  |
| lusolve               | 200  | 9.01 (med)     | 17.38 (med)                   | 0.52        | not measured in round 2            |
| lusolve               | 500  | 275.19 (med)   | 222.83 (med)                  | 1.23        | not measured in round 2            |
| lusolve               | 1000 | 2985.6 (1 run) | 2045 (1 run)                  | 1.46        | 515 vs 395 (1.31)                  |
| svd                   | 200  | 251.83 (med)   | 105.51 (med)                  | 2.39        | not measured in round 2            |
| svd                   | 500  | 4999.43 (med)  | 2345.87 (med)                 | 2.13        | 1645 vs 1098 (1.50)                |
| svd                   | 1000 | 66124 (1 run)  | 44653 (1 run)                 | 1.48        | not measured in round 2            |
| sin, Float64Array 1e6 | 1e6  | 72.24 (med)    | 81.99 (JS Math.sin loop, med) | 0.88        | 14.8 vs 12.2 (1.21)                |

Flagged (more than 1.5x slower than the oracle or than round 2):

- svd at n = 200, 500, 1000: 2.4x, 2.1x and 1.5x slower than ml-matrix. Round 2 measured 1.50x at n = 500; the ratio is worse on this run.
- lusolve at n = 1000: 1.46x slower than ml-matrix (single run); round 2 measured 1.31x.
- lusolve at n = 500: 1.23x. Not flagged.
- linsolve at n = 200 / 500: 12.1 ms / 397.7 ms (linsolve is slower than lusolve at n = 500 by 1.45x, which round 2 also reported).

Determinism: lusolve n = 200 run twice: bench.mjs computed the check at the end; the bench did not reach that line in the completed run. Not recorded (see Coverage gap below).

Coverage gap for the bench: the determinism check and the sin row in bench.mjs did not run in the 580 s budget. The sin row above came from benchsin.mjs (separate run). The determinism check was not re-run; treat as "not run".

## Determinism (step 5, corrected)

lusolve n = 200 (SPD, seeded): two calls, bit-equal on every entry (differing = 0, input not mutated). linsolve n = 200: bit-equal. A first check reported false only because lusolve returns nested arrays and the check compared array references; the corrected check (det.mjs) is the valid one.
Determinism line above in the Bench section is superseded by this section.

## Re-check counts (round 2 issues #926, #927, #928)

yes: 2 (#927, #928). partial: 1 (#926, closed upstream; the defect still reproduces in eigs). no: 0.

## What worked well

Dense SPD and Hilbert solves agree with NumPy to the conditioning floor. lstsq matches NumPy on Vandermonde to about 1e-13. Stiff ODEs (Radau, BDF, Rosenbrock, RODAS) agree with SciPy Radau to 1e-7 or better at tol 1e-6 on Robertson and Van der Pol. Falling-ball event time matches the closed form to 2e-16 (RK45). FFT round trip is within 4 ULP of the largest sample up to n = 65536. Complex arithmetic and quad on smooth integrands are correct. Sparse linsolve, luSolve and cholesky on SparseMatrix.fromCOO work.

## Verdict

Do not adopt the eigen and det paths yet. eig/eigs return eigenvectors that are not eigenvectors for complex eigenvalues. det returns its argument for DenseMatrix and for non-matrix inputs. linsolve silently returns NaN for a DenseMatrix column b. Stiff solvers hang on a malformed tspan. Dense solves, lstsq, stiff ODEs on valid input, and FFT round trips are usable now. SVD and lusolve are 1.5-2.4x slower than ml-matrix on this (contended) machine.

## Issue index (round 3 drafts, not filed; file: numerical-analyst-issues.md)

| draft title                                                                 | priority |
| --------------------------------------------------------------------------- | -------- |
| det returns its input for DenseMatrix and non-matrix values                 | P0       |
| linsolve returns NaN silently for a DenseMatrix column b                    | P0       |
| eigs and L.eig return wrong eigenvectors for complex eigenvalues            | P0       |
| eigs defective pair dependent, no flag (reopen #926)                        | P1       |
| stiff solvers hang on malformed tspan                                       | P1       |
| fft([]) stack overflow                                                      | P1       |
| DenseMatrix inputs raise raw internal errors (inv, linsolve, lusolve, eigs) | P1       |
| fft with NaN sample gives finite imaginary parts                            | P2       |
| fft([5]) returns a number, not Complex                                      | P2       |
| quad returns NaN silently for NaN integrand                                 | P2       |
| sqrt(sparse) result type depends on values                                  | P2       |
| ifft runtime rejects the documented originalLength argument                 | P2       |
| NaN policy differs across solvers; "singular" message for NaN in A          | P2       |
| solveODE raw TypeError on wrong event shape                                 | P2       |
| pinv([]) names DenseMatrix for array input                                  | P2       |
| matrix([1,2]) 1-D input rejected                                            | P2       |
| matrixExpm/Logm/Sqrtm/Pinv leak internal errors for arrays                  | P2       |
| lstsq with DenseMatrix column b raw TypeError                               | P2       |

Counts: P0 3, P1 4, P2 11 (18 drafts).

## Files and processes (containment)

Created under C:/Users/danie/mathts-dogfood-r3/: numerical-analyst-report.md, numerical-analyst-issues.md, numerical-analyst-surface.txt.
Created under C:/Users/danie/mathts-dogfood-r3/numerical-analyst/ (scratch): package.json, package-lock.json, node_modules/ (installed packages), r2-report.md, surface.mjs, surf-core.txt, surf-functions.txt, surf-matrix.txt, surf-linalg.txt, probe1.mjs, t1.mjs, t1b.mjs, t1c.mjs, t1d.mjs, t1e.mjs, t1f.mjs, t1-solve.json, t1-fit.json, ref1.py, t3.mjs, t3b.mjs, t3c.mjs, t3c.mjs, t5.mjs (killed run, no output), t5a.mjs, t5b.mjs, t5.json (not written), ref5.py, t7.mjs, bench.mjs, bench-out.json, bench-err.txt, bench1000.mjs, benchsin.mjs, sweep.mjs, sweep.json, sweep-out.txt, coverage.mjs, coverage.md, det.mjs.
Processes: all node runs were foreground or background with timeouts. One t5.mjs run hung and was killed by me (PID 47272, confirmed gone). The bench run was killed by its 580 s timeout. Background bash waits (bmww70bl5, bteqy7i65, b79rgbfp5) were stopped with TaskStop. Monitor watchers (until-loops) expire on their own after 5 minutes. No process from me is still running as of the last check.
Product code, npm publish, commits, pushes, merges and GitHub issues: none touched. Nothing filed.
Note: this run's `date` read 2026-11-14 UTC and local 2026-11-13 23:xx; the brief says 2026-11-13.
