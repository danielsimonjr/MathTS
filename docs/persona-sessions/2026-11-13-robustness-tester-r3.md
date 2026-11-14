# Robustness tester — npm dogfood round 3, 2026-11-13

I am a security and robustness engineer. I parse untrusted expression and workbook input on a server. I used only the published npm packages at the pinned versions (expression 0.14.0, parser 0.2.0, evaluator 0.2.0, core 0.28.0, functions 0.86.0, workbook 0.6.0). Node v26.13.0, Windows 11, ESM. I did not change product code, did not build the monorepo, and did not file, comment on or close any GitHub issue. Round-3 drafts are in `C:/Users/danie/mathts-dogfood-r3/robustness-tester-issues.md`. The sweep ran alongside other work on the machine during parts of the run; DoS timings are therefore approximate (noted where it matters).

## Goal

Find issues nobody has reported, across every export of the six packages, with edge inputs. Re-check the round-2 items. Run the persona tasks: sandbox, denial of service, workbook YAML, fuzz, error messages.

## What I tried, in order

1. Created the scratch project `C:/Users/danie/mathts-dogfood-r3/robustness-tester/` (`npm init -y`, `"type": "module"`). Installed the six pinned packages.
2. `npm ls --depth=0` (exact output):
   ```
   robustness-tester@1.0.0
   +-- @danielsimonjr/mathts-core@0.28.0
   +-- @danielsimonjr/mathts-evaluator@0.2.0
   +-- @danielsimonjr/mathts-expression@0.14.0
   +-- @danielsimonjr/mathts-functions@0.86.0
   +-- @danielsimonjr/mathts-parser@0.2.0
   `-- @danielsimonjr/mathts-workbook@0.6.0
   ```
   All versions match the pins.
3. Round-2 re-check (table below). Read the round-2 report from GitHub. Its findings are #921–#924 and its round-1 table is #806–#820, plus #883.
4. Surface inventory (`robustness-tester-surface.txt`): 1,682 lines, 1,676 export names across the six packages.
5. Persona task 1, sandbox (`sandbox.mjs`): 29 payloads through parser.parse, evaluator.evaluate, functions.evaluate, functions.parse, plus functions.compile. 148 rows. No host object, constructor or prototype escaped through any evaluate path. Parse-only paths return AST nodes, which is by design.
6. Persona task 2, DoS (`dos-case.mjs`, `dos-run.mjs`): 28 cases, one child per case. Results in the DoS section.
7. Persona task 3, workbook YAML (`workbook-probe.mjs`): 12 payloads. Results in the workbook section.
8. Persona task 4, fuzz (`fuzz.mjs`): 10,000 expressions, seed 20261113, grammar depth 4. A seeded generator, not fast-check, because fast-check is not in the install list.
9. Sweep (task 4c), all six packages (`sweep-child.mjs`, `sweep-run.mjs`, `sweep-resume.mjs`). Each export received: zero arguments; each of 62 edge values as a unary argument (undefined, null, 0, -0, NaN, Infinity, -Infinity, MAX_VALUE, subnormal, 1, 2, 1e308, empty and nested arrays, ragged array, 2000-element array, Float64Array, Complex, Fraction, BigNumber, Unit, DenseMatrix, empty DenseMatrix, object, function, strings, booleans); a 7x7 binary grid of edge values; one wrong-arity call with four arguments; the numeric and matrix types as first argument. Flags per call: non-Error throw, path leak in message, RangeError stack overflow, over 500 ms. Hangs are caught by a parent watchdog. The first parent was killed by my own 590 s foreground timeout at `divisors` (index 309). I resumed at index 310 with `sweep-resume.mjs`, which uses a 20 s watchdog instead of 60 s. Records from the first 309 exports used 60 s.
10. Edge verification of sweep hangs (`hang-verify.mjs`, one input per child, 10 s limit, `--max-old-space-size=512`): 20 pairs. Results in the sweep section.
11. Stack-overflow and empty-input verification (`stack-probe.mjs`, `stack2.mjs`, `stack3.mjs`, `stack4.mjs`). The first sweep flags recorded only the first input per export, so I reproduced each flagged export with the exact input.
12. Duplicate searches on GitHub (read-only) for every draft.
13. Coverage table generated from the sweep data: `C:/Users/danie/mathts-dogfood-r3/robustness-tester-coverage.md` (1,676 rows, one per export).

## Round-2 re-check

Each row is a repro run on the installed versions. The GitHub state column is the state before my run. Closed means the issue is closed; it does not mean the fix ships.

| Issue | Title (short)                             | GitHub state | Fixed on npm?      | Evidence (what I ran, what I saw)                                                                                                                                                                   |
| ----- | ----------------------------------------- | ------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #806  | WorkerPool() without script               | CLOSED       | not run here       | parallel is outside my install list.                                                                                                                                                                |
| #807  | addScalar(null) crash                     | CLOSED       | yes                | `addScalar(null,1)` → typed `TypeError: addScalar: unexpected type null`.                                                                                                                           |
| #808  | evaluate leaks parse                      | CLOSED       | yes                | `functions.evaluate('parse')` → `Undefined symbol "parse"`.                                                                                                                                         |
| #809  | huge literal → Infinity                   | CLOSED       | yes                | `evaluate('9'.repeat(400))` → `SyntaxError: Numeric overflow`.                                                                                                                                      |
| #810  | DenseMatrix.zeros(1e8,1e8)                | CLOSED       | partial            | `DenseMatrix.zeros(1e8,1e8)` → RangeError with element limit 1e8. But `functions.zeros(10001,10000)` returns 100,010,000 elements, and `functions.zeros(1e5,1e5)` aborts the process (new finding). |
| #811  | unit string DoS                           | CLOSED       | not re-run         | outside focus; the round-1 harness timing was not repeated.                                                                                                                                         |
| #812  | deg `.value` radians                      | CLOSED       | **no**             | `unit(180,'deg').value` → 3.141592653589793 (π).                                                                                                                                                    |
| #813  | add(null) / add(string)                   | CLOSED       | yes                | `add(null,1)` and `add('2',1)` → typed `TypeError: add: unexpected type ... at index`. Fixed.                                                                                                       |
| #814  | DenseMatrix 2D constructor                | CLOSED       | yes                | `new DenseMatrix([[1,2],[3,4]]).toArray()` → `1,2,3,4` (2x2 matrix).                                                                                                                                |
| #815  | multiply(matrix, 2)                       | CLOSED       | yes                | `multiply(matrix,2)` → `2,4,6,8`.                                                                                                                                                                   |
| #816  | host object via scope                     | CLOSED       | yes                | `evaluate('process', {process})` → `Security: evaluate cannot return a host object`.                                                                                                                |
| #817  | block comments                            | CLOSED       | yes                | `parse('/* c */ 1')` → `1`.                                                                                                                                                                         |
| #818  | workbook constructor key                  | CLOSED       | yes                | workbook with `constructor: 1` key parses.                                                                                                                                                          |
| #819  | Unit(NaN)                                 | CLOSED       | yes                | `unit(NaN,'m')` → `TypeError: Unit value must be finite`.                                                                                                                                           |
| #820  | workerpool chunkTyped docs                | CLOSED       | not run            | workerpool is outside my install list.                                                                                                                                                              |
| #883  | zero-arg createParse()                    | CLOSED       | yes                | `createParse()` returns a function.                                                                                                                                                                 |
| #921  | Regression deg `.value` (#812)            | CLOSED       | **no**             | same repro as #812: π. Closed on GitHub, still broken on npm.                                                                                                                                       |
| #922  | parse 𝟙 but evaluate throws               | CLOSED       | yes                | `parse('𝟙')` rejects with `Unicode mathematical digit ... not allowed`. Consistent.                                                                                                                 |
| #923  | mod(10,0) silent NaN                      | CLOSED       | yes                | `mod(10,0)` → `10` (mathjs convention). No NaN.                                                                                                                                                     |
| #924  | createParse(create(all)) missing AST deps | CLOSED       | not run as written | `all` is not exported from any installed package (functions and core checked). Cannot run the repro as written.                                                                                     |

Round-1 items marked "yes" were re-run with the round-1 harness payloads: no regression found in the rows I could run.

## New findings (round 3)

Each finding has a draft in `robustness-tester-issues.md`.

### P0 — complex(string) returns wrong values silently

`complex('2+3i')` gives `re` = a Complex object, `im` = 0, `String` = `Infinity`. The signature accepts string. No duplicate.

### P1 — fraction(string) throws an internal BigInt error

`fraction('1/3')` and `fraction('0.5')` throw `SyntaxError: Cannot convert 1/3 to a BigInt`. The signature accepts string. No duplicate.

### P1 — zeros(1e5,1e5) aborts the process with heap OOM (exit 134)

No catchable error. `ones(1e308)`, `hadamardMatrix(1e308)` and `bellNumbers(1e308)` abort the same way. `functions.zeros` has no element cap; #810 covers only `DenseMatrix.zeros`. No open duplicate.

### P1 — integer-argument functions do not return on huge inputs

`bernoulli(1e6)`, `bernoulli(1e308)`, `doubleFactorial(1e308)`, `subfactorial(1e308)`, `lucasL(1e308)`, `harmonicNumber(1e308)`, `integerSqrt(1e308)`, `eulerPolynomial(1e308)`, `bernoulliPolynomial(1e308)`, `divisors(1e308)`, `divisorSigma(1e308)` each ran past 10 s. `bernoulli(Infinity)` throws at once. No duplicate.

### P1 — empty input overflows the stack in fft, ifft, rfft, fftn, mean, std, variance

`fft([])` and the others throw `RangeError: Maximum call stack size exceeded`. `mean(matrix([]))`, `std(matrix([]))`, `variance(matrix([]))` do the same. `mean([])` returns NaN. No duplicate.

### P2 — scalar argument to pairwiseSum, sumSquaredDeviations, closestPair overflows the stack

Wrong type gives a stack overflow instead of a TypeError. No duplicate.

### P2 — evaluate error message echoes the whole undefined identifier

Message length equals input length + 19. A 1,000,000-character identifier gives a 1,000,019-character message. No duplicate.

### P2 — compile(string) error does not name the fix

`compile('2+3')` throws `Unknown node type: String`. #732 and #738 are closed and different. No duplicate.

### Reopen candidate — #921 and #812 are closed but still reproduce

`unit(180,'deg').value` is π on functions@0.86.0. Lead decides.

## Persona tasks

### Sandbox (task 1)

29 payloads, 5 entry points, 148 rows. Every evaluate path blocked the prototype, constructor, Function, eval, import, process, globalThis, require and assignment payloads. `import("fs")` in the thin evaluator throws `Security: call to forbidden function "import" is disabled. Pass { unsafe: true } to opt out.` The `{__proto__: {polluted_probe: 1}}` payload returned an Object and did not pollute `Object.prototype`. Parse-only entry points (`parser.parse`, `functions.parse`) return AST nodes for every payload, including `import("fs")`, `eval(...)` and `x = process`. That is by design only if no caller evaluates the AST; the `evaluate` paths were the security boundary and held.

Note on my probe: `functions.compile` does not exist. The compile entry is in `expression` and `evaluator` and takes a node, which gives the finding above.

### Denial of service (task 2)

28 cases, one child per case. Each row: wall time includes ~4 to 5 s of import overhead.

| Case                                                  | Result                                            | Limit reached                                                           |
| ----------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| nesting 125 (evaluator)                               | returned 1                                        | at limit, accepted                                                      |
| nesting 126 (evaluator, functions, compileExpression) | threw "exceeds nesting limit (char 126)"          | correct                                                                 |
| nesting 100000                                        | threw nesting limit                               | correct, 15 ms                                                          |
| sin chain 5000 / unary minus 5000 / chained add 3000  | threw nesting limit                               | correct                                                                 |
| length 1e6 exact (functions)                          | threw "exceeds compile depth 512", 3 s, 294 MB    | correct, slow for a 1e6 input                                           |
| length 1.5e6                                          | threw "exceeds 1000000 characters", 3 ms          | correct                                                                 |
| length 1e6 identifier (evaluator)                     | threw with 1,000,019-character message, 739 ms    | finding (error echo)                                                    |
| 2^10000, 2^(2^(2^20)), 10^1e6                         | Infinity, no hang                                 | correct                                                                 |
| factorial(170, 200, 1e6, 1e9)                         | 7.2e306 or Infinity, no hang                      | correct                                                                 |
| range size(1:1e8)                                     | watchdog 15 s                                     | **see note**: a 1e8-element materialisation is slow; no size cap found. |
| zeros(3000,3000)                                      | 375 ms in isolation, watchdog hit in parallel run | harness artifact, not a finding                                         |
| zeros(1e4,1e4)                                        | 2.8 s, 1.2 GB RSS in isolation                    | no cap on the functions path                                            |
| zeros(1e5,1e5)                                        | heap OOM abort, exit 134                          | **finding** (P1)                                                        |
| identity(1e4)                                         | 1.0 s, 2.0 GB RSS                                 | no cap; memory-heavy                                                    |
| det(random 300x300)                                   | my probe error (random takes shape, not array)    | probe error, not a finding                                              |
| large string parse (200,000 chars)                    | returned 200000                                   | correct                                                                 |

### Workbook YAML (task 3)

12 payloads through `parseWorkbook` and `createExecutor`.

- Anchor alias duplicate id: rejected with `Duplicate cell id` (correct).
- Merge key `<<`: parsed, cell id kept as `m1` (I did not verify the merge semantics; not a finding).
- `!!js/function` tag: parsed as text, failed as MathTS (`Unexpected operator {`). Neutralised.
- `!!python/object/apply` tag: failed as undefined symbol `id`. Neutralised.
- `__proto__` as a YAML key: rejected as `Disallowed key "__proto__" (prototype pollution)`. Correct.
- `__proto__` as a cell id: accepted as id `__proto__`. No pollution. Not a finding.
- `process`, `evaluate('process')`, assignment in a cell: all blocked with a clear security message.
- Excessive YAML aliases (40-level bomb): rejected with `Excessive alias count`. Correct.
- 2000-cell workbook: parsed, cells ran. Correct.
  No pollution (`({}).polluted` stayed undefined in every payload).

### Fuzz (task 4)

10,000 expressions, seed 20261113, depth 4, grammar: numbers, x, y, pi, e, + - * / ^, unary minus, sin cos sqrt abs exp, max(a,b), parentheses.

- Parse errors: 0. Non-Error throws: 0.
- `toString -> parse -> toString` not a fixed point: 0.
- Numeric meaning changed after round trip: 0 of 7,433 finite comparisons (tolerance 1e-9 relative).
- RangeError from the evaluator: 0. Run time 5.2 s.
  Gap: the grammar does not include implicit multiplication (`2x`), matrices, or units. Those were not fuzzed.

### Error messages (task 5)

The sweep's path-leak check (`/[A-Za-z]:\\|\/Users\/|node_modules|\.m?js:\d+/`) flagged no export. The one finding is the identifier echo above. Stack overflows (RangeError) are the other error class; they leak no path but do not name the problem.

## Sweep and coverage

- Exports in inventory: 1,676 names (1,682 lines, six headers).
- Called with the edge battery: 1,478.
- Non-function exports (constants, objects, classes): 155. Recorded by type; not called.
- Skipped by design: `functions.import` and `functions.config`, which mutate global state. Not probed. Gap: `import` and `config` are not covered.
- Hang or abort on the sweep input: 42 exports (listed below). Each was called at least once before the hang, so all 42 count as called.
- Stack-overflow flags: `closestPair`, `fft`, `fftn`, `ifft`, `mean`, `rfft`, `std`, `variance`, `zeta` (functions); `pairwiseDot`, `pairwiseSum`, `sumSquaredDeviations` (core). Reproduced: see findings above. `zeta` flag comes from an empty-string-as-first-argument call; I did not reproduce it separately and mark it unverified.
- Over-500 ms calls: 38 exports, all on the 2000-element array or on large dimensions. Not findings on their own.
- Workbook `topologicalSort` hang on the sweep: not reproduced with any of the nine sample types. Unresolved; likely a watchdog artifact from the concurrent run. Not drafted.
- Non-verified observation: `betweennessCentrality` returned a Promise in the sweep. I did not check its .d.ts return type. Not drafted.
- Contract comparison (step 4d) was done for the findings above, not for every export. A full .d.ts-versus-runtime pass over 1,478 exports was not run.

Hang and abort list (sweep input, verified individually where marked):

- Verified unbounded or past 10 s: bernoulli, bernoulliPolynomial, doubleFactorial, subfactorial, lucasL, harmonicNumber, integerSqrt, eulerPolynomial, divisors, divisorSigma.
- Verified heap OOM abort: zeros, ones, hadamardMatrix, bellNumbers.
- Not verified individually (sweep hang, input unknown): butter, coulombFG, coulombG, discriminant, expn, gegenbauerC, isolateRealRoots, jacobiP, katzCentrality, lerchPhi, lfilterZi, minimumEnclosingCircle, permutationsGen, polygamma, rankdata, realRoots, riemannSiegelZ, rootsChebyshevT, rootsChebyshevU, rootsLaguerre, rootsLegendre, siegelZ, sphericalBesselK, sphericalBesselY, wassersteinDistance, wilcoxon. Many of these take arrays and may be slow on the 2000-element sample rather than infinite. Not drafted; the lead can re-run them with a 10 s limit on a specific input if wanted.

## Coverage

Full table (1,676 rows: export, package, called, edge inputs, finding) is in `C:/Users/danie/mathts-dogfood-r3/robustness-tester-coverage.md`.

Coverage: 1,478 of 1,676 exports called with the edge battery. 155 non-function exports recorded by type. 42 called and hung or aborted. 1 skipped (`import`). Workbook `topologicalSort` is counted as a hang in the sweep but not verified.

## Bench

Not applicable to this persona.

## What worked well

- The thin evaluator and the full functions evaluate both blocked every sandbox payload, including host objects and prototype walks.
- The nesting, length and compile-depth limits held exactly at the documented boundaries (125 accepted, 126 rejected; 1,000,000 characters; compile depth 512).
- Workbook YAML: `__proto__` keys, `evaluate`, and assignment are all rejected with clear messages; alias bombs are rejected.
- Fuzz: no crash, no round-trip meaning change across 7,433 finite comparisons.
- Round-2 fixes that do ship: #807, #808, #809, #813, #814, #815, #816, #817, #818, #819, #883, #922, #923.

## Verdict

I would deploy the thin `evaluate` for arithmetic-only user input, with the server holding the input length and nesting caps. I would not deploy the full `functions` path for untrusted input yet: integer-argument functions run without bound, `zeros` and friends abort the process instead of throwing, and empty input overflows the stack in the FFT and statistics functions. `complex(string)` returns wrong values silently, so any server path that accepts a complex string is unsafe until that is fixed. I would also not rely on `unit(...).value` for degrees while #921 reproduces.

## Issue index (round 3)

| Draft title                                                                                            | Priority | Labels                                       |
| ------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------- |
| complex('2+3i') returns a Complex with re set to a Complex object and im 0                             | P0       | dogfood, bug, P0, persona:robustness-tester  |
| fraction('1/3') and fraction('0.5') throw SyntaxError "Cannot convert ... to a BigInt"                 | P1       | dogfood, api, P1, persona:robustness-tester  |
| zeros(1e5, 1e5) aborts the process with a heap OOM; functions.zeros has no element cap                 | P1       | dogfood, bug, P1, persona:robustness-tester  |
| Integer-argument functions run without bound on huge inputs                                            | P1       | dogfood, bug, P1, persona:robustness-tester  |
| fft([]), ifft([]), rfft([]), fftn([]) and mean/std/variance of an empty DenseMatrix overflow the stack | P1       | dogfood, bug, P1, persona:robustness-tester  |
| pairwiseSum(0), sumSquaredDeviations(0) and closestPair(0) overflow the stack                          | P2       | dogfood, bug, P2, persona:robustness-tester  |
| evaluate() error message echoes the whole undefined identifier                                         | P2       | dogfood, api, P2, persona:robustness-tester  |
| compile(string) throws "Unknown node type: String" and does not name the fix                           | P2       | dogfood, docs, P2, persona:robustness-tester |

Reopen candidate (not a new draft): #921 / #812, `unit(180,'deg').value` still π.

## Files and processes I created

Files in `C:/Users/danie/mathts-dogfood-r3/robustness-tester/`:

- package.json, package-lock.json, node_modules/ (npm install of six pinned packages)
- Probes and harness: probe0.mjs, probe1.mjs, compile-probe.mjs, sandbox.mjs, workbook-probe.mjs, fuzz.mjs, timing-check.mjs, hang-verify.mjs, hang-list.txt, topo-check.mjs, stack-probe.mjs, stack2.mjs, stack3.mjs, stack4.mjs, recheck.mjs, recheck2.mjs
- Sweep: sweep-child.mjs, sweep-run.mjs, sweep-resume.mjs, dos-case.mjs, dos-run.mjs, dos-ids.txt
- Fetched references: r2-report.md (round-2 report), r1-harness.txt (round-1 harness)
- Output: out/sweep-{expression,parser,evaluator,core,functions,workbook}.ndjson, out/dos.json, out/sandbox.json, out/workbook.json, out/fuzz.json, out/hang-verify.ndjson, out/resume.log

Files in `C:/Users/danie/mathts-dogfood-r3/`:

- robustness-tester-report.md (this report; written by me)
- robustness-tester-surface.txt (export inventory)
- robustness-tester-issues.md (issue drafts)
- robustness-tester-coverage.md (coverage table)

Processes: every probe and sweep child was run with spawnSync or a timeout and exited. The sweep, DoS, hang-verify and resume jobs ran as background tasks; each completed (exit 0, or exit 124 for the first sweep's parent, which I resumed). I did not verify by PID that no node process of mine remains. I did not run `sweep.ps1`.
