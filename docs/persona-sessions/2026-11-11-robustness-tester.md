# Persona session — robustness tester (2026-11-11)

I am a security and robustness engineer. Before a library sits behind a server that
parses user input I fuzz it: random expression strings, sandbox payloads, DoS
sizes, algebraic round-trips, and invalid types. Rounds 1–2 already filed
#688–#787; I deduped against those titles and did not re-file #714, #715, #722,
#723, #725, or #696.

**Goal:** treat published MathTS packages as the only API (`npm i @danielsimonjr/mathts-*@latest` in a scratch ESM tree). Never import internals. Record every crash, hang, leak, and inconsistent error.

**What I did not do:** I did not patch the library. I did not build or pack from this repo.

## Environment

- MathTS git SHA at session start: `fef4010b8a468215a26bcdb9642db0556055b9bb`
- Scratch dir: `/tmp/mathts-robust`, Node `v22.23.4`, ESM
- OS: Linux 6.12.113+ x86_64, Intel Xeon (KVM) 4 cores
- Packages: core 0.26.0, matrix 0.10.0, functions 0.84.0, parser 0.1.34,
  evaluator 0.1.33, expression 0.12.7, units 0.7.5, numbers 0.1.28,
  workbook 0.5.18, workerpool 0.4.0, parallel 0.10.0, arithmetic 0.1.86
- Property tests: `fast-check` seed **20261111**
- Harness (re-run later): `docs/persona-sessions/bench/2026-11-11-robustness-tester.harness.mjs`
- Results JSON: `docs/persona-sessions/bench/2026-11-11-robustness-tester.json`

`createParse` / `createEvaluate` from the thin parser/evaluator packages still
throw (already #715). I used `parse` / `evaluate` from `@danielsimonjr/mathts-functions`,
which is the documented consumer path.

## What I tried, in order

1. **Sandbox payloads** into `evaluate`: `constructor`, `__proto__`,
   `Function(...)()`, `eval`, `process`, `globalThis`, `import.meta`,
   `sin.constructor`, `sin.apply`, `x.then` on a Promise. All denied except
   when I _put_ `process` on the scope (see #816). Object-literal
   `{__proto__: ...}` is blocked by `setSafeProperty`. This part of the 2026-05
   sandbox still holds.

2. **DoS / limits.** Parenthesis nesting 124 accepts, 125 rejects (matches
   published behaviour; docs-vs-off-by-one is #722). Compile depth 512 fires on
   `1+1+…`. Unary minus depth 500 fires. `factorial(200)` / `2^10000` are
   IEEE `Infinity` (not a hang). A 200×200 matrix literal in the expression
   language evaluated in 41 ms. Expression length cap 1e6 works.

3. **Huge numeric tokens.** `'9'.repeat(400)` and `1e309` become `Infinity`
   with no error (#809). `JSON.stringify` of that result is `null`, which is how
   I first mis-read it as a `null` return.

4. **Invalid types** on `add` / `addScalar` / `DenseMatrix` / `Unit`.
   `addScalar(null, 1)` is a P0 `.im` crash (#807). Typed `add(null, 1)` is
   “Too few arguments” (#813). `add('2', 1)` returns Complex 3+0i.

5. **Algebra.** `add`/`multiply` commute for 200 finite doubles at seed 20261111. `evaluate` of 400 random strings ≤80 chars never threw a
   non-Error or a stack overflow. Format/eval round-trip of finite doubles
   held within 1e-12 on a 100-run sample.

6. **Units.** km→m→km `.value` round-trips 1234. `deg` does not: `.value` is
   always radians (#812). Invalid `'m'.repeat(n)` parse time grows faster than
   linear (#811). `new Unit(NaN,'m')` is `NaN m` (#819).

7. **Matrix.** `new DenseMatrix([[1,2],[3,4]])` is the numpy-shaped call and
   throws `1,2,3,4×undefined` (#814). `fromArray` works. `.multiply(2)` is
   `undefined×undefined` (#815); `.scale(2)` is the scalar path.
   `zeros(1e8,1e8)` is a V8 `Invalid typed array length` (#810).

8. **Workbook.** README YAML parses. Sibling `depends_on` _does_ bind outputs
   (`n` → `gaussSum` → test). `{ secret: 42 }` is readable from another cell
   (that is the product). Adding `constructor: 1` to the object literal kills
   the cell and dependents look like `Undefined symbol` (#818). Formula
   injection of `process` / `({}).constructor` is denied, same as evaluate.

9. **Workers.** `new WorkerPool()` from `mathts-parallel` (no script) does not
   throw; it unhandled-rejects on `workerScript.startsWith` (#806). Still on
   master. `ComputePool.initialize()` + `sin({forceParallel:true})` at n=3
   works (`parallelized: true`). `MathWorkerPool.exec('nope')` is `Unknown
method`. `execFunction` timeout on a never-resolving Promise is `Promise
timed out after 500 ms`. Hung-worker replacement on the _parallel_
   `WorkerPool` was not exercised because construction without a script never
   reaches `execute`.

10. **BigNumber constructor.** `new BigNumber(2)` from core throws on
    `toString` / `add` mixes BigInt — same as #714 (numbers package). I could
    not comment on #714 (`GraphQL: Resource not accessible by integration`).
    `evaluate('bignumber(0.1)+bignumber(0.2)')` works.

## Findings

| #                                                         | Sev | Title                                                                    | Labels (intended)                            |
| --------------------------------------------------------- | --- | ------------------------------------------------------------------------ | -------------------------------------------- |
| [806](https://github.com/danielsimonjr/MathTS/issues/806) | P0  | `new WorkerPool()` unhandled `workerScript.startsWith`                   | dogfood, bug, P0, persona:robustness-tester  |
| [807](https://github.com/danielsimonjr/MathTS/issues/807) | P0  | `addScalar`/`number` crash on null (`.im`)                               | dogfood, bug, P0, persona:robustness-tester  |
| [808](https://github.com/danielsimonjr/MathTS/issues/808) | P1  | `evaluate` leaks live `parse`/`typed`; `typed()` callable without unsafe | dogfood, bug, P1, persona:robustness-tester  |
| [809](https://github.com/danielsimonjr/MathTS/issues/809) | P1  | Overflow integer literals → silent `Infinity`                            | dogfood, bug, P1, persona:robustness-tester  |
| [810](https://github.com/danielsimonjr/MathTS/issues/810) | P1  | `DenseMatrix.zeros(1e8,1e8)` Invalid typed array length                  | dogfood, bug, P1, persona:robustness-tester  |
| [811](https://github.com/danielsimonjr/MathTS/issues/811) | P1  | Unit parser superlinear on long invalid strings                          | dogfood, perf, P1, persona:robustness-tester |
| [812](https://github.com/danielsimonjr/MathTS/issues/812) | P1  | `Unit.value` for deg is radians vs README `.to()`                        | dogfood, bug, P1, persona:robustness-tester  |
| [813](https://github.com/danielsimonjr/MathTS/issues/813) | P2  | `add(null)` too few args; `add(string)` → Complex                        | dogfood, api, P2, persona:robustness-tester  |
| [814](https://github.com/danielsimonjr/MathTS/issues/814) | P2  | `new DenseMatrix([[…]])` → `1,2,3,4×undefined`                           | dogfood, api, P2, persona:robustness-tester  |
| [815](https://github.com/danielsimonjr/MathTS/issues/815) | P2  | `.multiply(2)` → undefined×undefined                                     | dogfood, api, P2, persona:robustness-tester  |
| [816](https://github.com/danielsimonjr/MathTS/issues/816) | P2  | `evaluate('process', {process})` returns host object                     | dogfood, bug, P2, persona:robustness-tester  |
| [817](https://github.com/danielsimonjr/MathTS/issues/817) | P2  | no `/* */` comments (`Value expected`)                                   | dogfood, api, P2, persona:robustness-tester  |
| [818](https://github.com/danielsimonjr/MathTS/issues/818) | P2  | workbook `constructor` key fails cell + dependents                       | dogfood, bug, P2, persona:robustness-tester  |
| [819](https://github.com/danielsimonjr/MathTS/issues/819) | P2  | `new Unit(NaN,'m')` accepted                                             | dogfood, api, P2, persona:robustness-tester  |
| [820](https://github.com/danielsimonjr/MathTS/issues/820) | P2  | `chunkTyped` README-internal but root-exported                           | dogfood, api, P2, persona:robustness-tester  |

Token labels could not be applied (owner rule: 403). Each body starts with
`Labels: …`.

### Duplicates I did not re-file

- #714 BigNumber constructor (also true for `mathts-core`; factory `bignumber()` works)
- #715 `createParse`/`createEvaluate` throw
- #722 nesting 125 docs vs published 124/125
- #723 `parse("1e")` → `1 e`
- #725 assignment needs `{ unsafe: true }` (I used that flag only to probe `parse()` calls)
- #696 `./package.json` not exported

## Verdict

I would **not** put default `evaluate(userString)` on the public internet without
an identifier allow-list: the constructor/`__proto__`/`eval` denylist is real,
but `parse` and `typed` leak out of the default scope (#808) and any host object
in `scope` comes back by identity (#816). I would also wrap `addScalar` and
`DenseMatrix.zeros` because null and huge dims are crashes, not 400s.

Random grammar fuzz (seed 20261111, 400 strings) did **not** find a hang,
ReDoS in the expression lexer, or stack overflow under the documented nesting
caps. Algebraic commute for `add`/`multiply` on finite doubles held. Workbook
formula injection does not reach `process` unless you put it in scope; it can
still knock out a notebook with a reserved object key (#818).

Re-run: copy the harness into a scratch project that has the published
packages and `fast-check`, then `node 2026-11-11-robustness-tester.harness.mjs`.
