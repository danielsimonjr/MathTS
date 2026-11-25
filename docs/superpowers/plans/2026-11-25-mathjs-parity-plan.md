# mathjs 15.3.0 parity fix plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@danielsimonjr/mathts-compat` `create(all)` match mathjs 15.3.0 on every name in tracker #1590 (issues #1549–#1589), by fixing the shared causes, and record an explicit decision for every mathjs name the typed packages do not export.

**Architecture:** Compat stops wrapping the narrow typed-surface functions and binds the mathjs-shaped factories that already live in `functions`. The expression sandbox stays the default of the typed `evaluate` / `parser` and becomes opt-in on the compat instance, whose default evaluator is the mathjs one (assignment, function definitions, `simplify` / `derivative` / `parse` / `evaluate` / `compile` / `parser` / `help` / `config`, node methods, `ResultSet` blocks). Behavior that is more correct than mathjs stays, and is pinned. Cosmetic output matches mathjs. The oracle pin moves to 15.3.0 before any later differential test is written.

**Tech Stack:** TypeScript ESM, Bun, Vitest, changesets, mathjs 15.3.0 as a `compat` devDependency (the oracle). No new runtime dependencies.

## Global Constraints

- Fix the root cause. Do not add a shim that special-cases one input while the function underneath stays wrong.
- Do not weaken, skip, or delete an existing test, timeout, or assertion. A test that encodes a non-mathjs result is updated only when the issue proves that result wrong, and the assertion stays (the expected value changes, with a comment that cites the issue).
- No new runtime dependency. `mathjs` stays a devDependency of `compat`.
- No force-push, amend, or rebase. Never delete a branch.
- CHANGELOG bullets go newest-first under the existing `## [Unreleased]` heading of the root `CHANGELOG.md`. Insert the new bullet above the current first bullet. Never replace a heading. Package changelogs are owned by changesets: add a `.changeset/*.md` file; do not hand-edit a published version section.
- There is no `NOTES.md`. The root changelog bullet is the note. Do not create a second notes file.
- Do not publish, tag, or set `RELEASES_ENABLED`.
- Import extensions in `functions`, `expression`, `compat`, and `core` are `.js`.
- Existing physics-constant tests and numerical-result tests stay as they are unless an issue in this plan names that result.
- The typed-package sandbox tests (`expression/tests/security/sandbox.test.ts` and the functions evaluate security tests) stay green. Compat does not import a weaker copy of those checks into the typed API.
- Every new differential test compares `typeOf` plus `format(value, { precision: 14 })` with mathjs 15.3.0, or the same thrown error name and the same message prefix through the first stable clause. Relative numeric tolerance inside that format is the one the issue states (1e-9 in the tracker method, 1e-12 in #1550). Use 1e-12 for value compares and precision 14 for the string compare.
- A test is written first. The mutation check is: run it on the unfixed tree and record the failure. That failure is the proof. Do not merge a test that already passes.

## How this plan was checked

Two methods, both on 2026-11-25.

1. **Source at HEAD `59a9656d`** (issues were captured at `76f7a5b7`; the same lines are still present). Citations below are from that tree.
2. **A live mathjs 15.3.0 process** (`npm install mathjs@15.3.0` in `/tmp/mj`, Node 22). It confirms the expected column of the issues: `pow` of a BigNumber matrix returns a `Decimal` cell (`typeOf` `BigNumber`), `eigs([[1,2],[3,4]], 2).values` is `[0, 5]`, `schur` diagonal is `[5.372…, -0.372…]` with a `5.15e-118` subdiagonal, `solveODE((t,y)=>y,[0,1],1)` has `t.length === 3` and `t[1] ≈ 0.6029029729200805`, `catalan(30n)` is the bigint `3814986502092304`, `multinomial([[1,2],[3,4]])` throws `RangeError: Dimension mismatch (2 != 1)`, `acsc(0)` is Complex `Infinityi`, `dotPow(sparse, 0)` is a DenseMatrix `[[1, 1]]`, `evaluate('1; 2')` is a `ResultSet` whose `entries` are `[2]`, `evaluate('1\n2')` is a `ResultSet` with `[1, 2]`, `expression.transform` has the 26 keys listed in G13, `mathWithTransform` has 315 keys, `count(true)` is `4`, `version` is `"15.3.0"`, `parse('true and false').toTex()` is `true\wedgefalse`, and Fraction-config `parse('1/3 + 1/4').toString()` is `1/1 / 3/1 + 1/1 / 4/1`.

The compat binary was not rebuilt in the planning session. The “actual” column is the issue capture, and each root cause below is a line that still produces that result. An implementer re-runs the issue’s repro after `bunx turbo build --filter=@danielsimonjr/mathts-compat` before editing, and pastes the output into the PR. If HEAD has already moved a case, delete that case from the group and say so; do not re-fix it.

---

## Shared design

### S1. Oracle is mathjs 15.3.0 (do this before any other group)

`compat/package.json` devDependency `"mathjs": "15.2.0"` becomes `"mathjs": "15.3.0"`. `compat/scripts/gen-parity-names.mjs` and the header of `compat/src/parity-names.generated.ts` say 15.3.0. 15.3.0 adds no export names (tracker #1590; re-check with `Object.keys` of the module and of `create(all)` while regenerating). It does change `multinomial`, `catalan(bigint)`, sparse `dotPow` / `dotDivide` / `divide`, and the bigint-to-number conversion. Those four are G11. The generator and the existing parity tests must stay green at the pin bump **except** tests that assert the 15.2.0 behavior of those four. Those tests are updated in G11, not deleted: change the expected value to the 15.3.0 value in the same commit as the implementation. **Do not skip those tests in G00** — CI's skip-budget gate (`node tools/test/check-skip-budget.mjs`) fails on any new skipped test. Land G00 and G11 together on the same branch/PR so the suite is green without skipping. Do not lower any other assertion to make the pin bump pass.

A scheduled check: `.github/workflows/mathjs-oracle.yml`, `cron` weekly, `workflow_dispatch` as well. It runs `npm view mathjs version` and, when that string differs from the `mathjs` devDependency in `compat/package.json`, opens (or updates an existing open) GitHub issue titled `[parity] mathjs oracle update: <latest>` (requires `permissions: { issues: write }`) and fails the job. The job opens no release. Dependabot is not required if this workflow exists. The workflow must not publish.

### S2. `create(all)` binds mathjs-shaped factories

`compat/src/index.ts` (the map around lines 486–600) currently points `ceil`, `floor`, `fix`, `round`, `identity`, `ones`, `std`, `variance`, `min`, `max`, `sum`, and others at `compat/src/shims.ts`, and spreads `mathFunctions` (the typed surface) for the rest. A few names are already `factory_*`.

The rule after this plan:

- The instance property and the named export for a mathjs function are the factory created by `create<Name>` in `functions` (`functions/src/factories/index.ts` exports `factory_<name>`). That factory is built with the instance’s `typed`, `config`, and `matrix` so `number: 'BigNumber'` and `matrix: 'Array'` apply.
- A shim remains only when the factory cannot see the instance config. Each remaining shim has a comment that quotes the mathjs behavior it preserves. The audit list in #1550 (complex, fraction, bignumber, matrix, sparse, divide, pow, sqrt, abs, exp, log, sin, cos, tan, asin, acos, atan, atan2, gcd, lcm, conj, re, im, transpose, det, zeros, size, isComplex, isFraction, isBigNumber, isNumber, isMatrix) is checked one name at a time. `zeros` already delegates most forms to the factory (`compat/src/shims.ts` `zeros`); keep that delegation, and make `zeros(n)` return a Matrix when `config.matrix === 'Matrix'`, which is what mathjs does. Today `identity` is `function identity(n: number)` and ignores every argument after the first (`DenseMatrix.identity(n)`), and `ones(n)` returns a `number[]` on purpose. Both go away as shims.
- `std(complex, 2)` and `variance(complex, 2)` stay wrong even through the current factory (the issue says so). G02 changes `functions/src/statistics/std.ts` and `variance.ts` so a Complex scalar is complex, not a real magnitude. That is the statistics implementation, not a compat wrapper.
- Named exports from `compat/src/index.ts` are the same function objects as the instance properties. A test imports `{ ceil, identity, ones }` and also calls `create(all).ceil`.

`identity(2, 3)` is 2×3, `identity(7, 2)` is 7×2, `identity()` is an empty DenseMatrix, `identity([2, 3])` is an Array. `ceil(3.14159, 2)` is `3.15`. `floor(unit('3.241 cm'), unit('cm'))` is `3 cm`. `ones(2)` is a DenseMatrix under the default config. `unaryMinus(unit('5 cm'))` is `-5 cm`. `max(unit('5 cm'), unit('2 inch'))` is `2 inch`. `sum(true)` and `max(true)` stay boolean. `nthRoot([1,2,3],[4,5,6])` broadcasts. `compare` of two Fractions is a Fraction `1/1`; of two BigNumbers is a BigNumber. `arg(bignumber('2.5'))` is a BigNumber `0`, and the current shim calls `.atan2` on the BigNumber (`compat/src/shims.ts` around the `arg` export). The factory must call the BigNumber `atan2`.

### S3. Expression security model

Two policies, one implementation.

| Caller                                                                                                          | Default                                                                                                                                                                                                                                                                                                                                                                                | Opt-in                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `@danielsimonjr/mathts-functions` `evaluate` / `parser` / `compileExpr`, and `@danielsimonjr/mathts-expression` | Safe. `validateAst` in `expression/src/evaluator/evaluate.ts` rejects `AssignmentNode`, `FunctionAssignmentNode`, and `FORBIDDEN_FUNCTIONS` (`import`, `createUnit`, `evaluate`, `parse`, `compile`, `typed`, `simplify`, `derivative`, `help`, `chain`). `sanitizeEvaluateResult` still runs.                                                                                         | `{ unsafe: true }` as today.                                                                                                                 |
| `@danielsimonjr/mathts-compat` `create(all)` `evaluate`, `compile`, `parser().evaluate`, and `Parser`           | Mathjs. No `validateAst`. No `sanitizeEvaluateResult`. The scope contains the instance functions, including `simplify`, `derivative`, `parse`, `evaluate`, `compile`, `parser`, `help`, and `config` (the function). Assignment and function definitions work. Node methods (`.evaluate`, `.compile`) are reachable through `getSafeMethod` for objects the expression itself created. | `{ safe: true }` turns the typed-API validator on for that call. This is the only extra hardening. It is opt-in. It must not be the default. |

`expression/src/Parser.ts` line 116 calls `evaluate(expr, this.scope)` with no options, so a parser can never assign. The compat parser does not use that default. `wireMathjsInstanceApi` (`compat/src/instance-api.ts`) builds the parser with the mathjs policy. The typed `parser()` in `functions/src/factories/evaluate.ts` (the comment at line 509 says assignment is rejected) stays safe.

`FORBIDDEN_FUNCTIONS` is not deleted. The typed API still consults it. Compat’s mathjs policy does not call `validateAst`.

`config` inside an expression is the instance function. `compat/src/index.ts` around line 402 spreads `mathFunctions.config()` into the scope object, and the expression-constant loop then binds the name `config` to that object. Bind the function. The keys `relTol`, `matrix`, `number`, and the rest are not expression names unless mathjs puts them there (it does not). `evaluate('config()')` returns the same fields mathjs returns: `relTol`, `absTol`, `matrix`, `number`, `numberFallback`, `precision`, `predictable`, `randomSeed`, `legacySubset`. `evaluate('config({number: "Fraction"})')` updates that instance and returns the new config. A second `create(all)` is unchanged.

Host-object rules for the mathjs policy: a method call on a node returned by `parse` works (`node1.evaluate()` is `5`). A method call on `Object.prototype` or a forbidden name (`__proto__`, `constructor`, `prototype`) still throws. That check stays in `expression/src/utils/customs.ts`. Do not remove it. It does not reject `evaluate` on a `Node`.

Block results (this is #1556, same evaluator): `expression/src/compiler/compile.ts` `compileBlockNode` (lines 593–596) returns the single visible value, or a plain array when several are visible. `BlockNode._compile` in `expression/src/node/BlockNode.ts` already returns `new ResultSet(results)`. The string path uses the compiler, so `evaluate('1; 2')` is the number `2` and `evaluate('1\n2')` is an Array, while `parse('1; 2').evaluate()` is a ResultSet. Change `compileBlockNode` to return `new ResultSet(results)` for every block, including one visible statement and including zero (`undefined` only when mathjs does; the oracle returns a ResultSet for both repro strings). Take the constructor from `math.ResultSet`. `instanceof math.ResultSet` is then true. Do this inside the compiler so both policies share it. The typed API will also return a ResultSet for blocks. That matches mathjs and does not weaken a security test. If a typed-API test expects the unwrapped number, update the expected value and cite #1556; do not delete the test.

Function `name` (#1580): `expression/src/node/FunctionAssignmentNode.ts` builds `typed(name, signatures)` and sets `syntax`, but the function object’s `.name` stays the typed-function default `fn`. After `typed` returns, set the name to the declared name (`isOdd`). `format` already prints `f(a, b)` and must stay that way.

Migration guide (#1576): `docs/migration-guide.md` line 95 says both mathjs and compat evaluate are “sandboxed”. Replace that row so it states: mathjs `evaluate` allows assignment, function definitions, and calls to `simplify`, `derivative`, `parse`, `evaluate`, `compile`, `parser`, `help`, and `config`; compat `create(all)` does the same by default; the typed `evaluate` rejects them unless `{ unsafe: true }`; compat callers who want the typed policy pass `{ safe: true }`. Add a six-line example: `parser().evaluate('x = 3')` then `'x + 1'` is `4`. Point at #1549. Also fix `docs/api/compat.md` and `compat/README.md` if they repeat the old sentence. The guide’s oracle sentence still says mathjs 13.2.3; change the compat-parity sentence to 15.3.0 without rewriting unrelated history.

### S4. Decisions that are not “copy mathjs”

| Issue                      | Decision                                                                                                                                                                                                                                                                                                                                      | Why                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1578                      | **Match mathjs.** `parse('true and false').toTex()` is `true\wedgefalse`, `not true` is `\negtrue`, `true xor false` is `true\veebarfalse`.                                                                                                                                                                                                   | The missing space makes an invalid LaTeX macro. That is a typesetting defect, not a wrong mathematical value. The planner default for #1578 is to match.                                       |
| #1581                      | **Match mathjs.** `version` on the instance, the named export, and `evaluate('version')` is the string `"15.3.0"`. Add `compatVersion` with the compat package version (`0.7.x` after the bump).                                                                                                                                              | Feature detection via `math.version` is the mathjs contract. The package version remains available under a new name.                                                                           |
| #1584                      | **Match mathjs.** `schur([[1,2],[3,4]]).T` is `[[5.372281323269, -1], [5.1470165474828e-118, -0.37228132326901]]`. `solveODE((t,y)=>y,[0,1],1)` has three times, `t[1] === 0.6029029729200805` within 1e-12, and `y.at(-1)` formats as `2.7182938335114`.                                                                                     | Both current answers are valid. The issue is a drop-in reproducibility decision, and the default is to match.                                                                                  |
| #1585                      | **Keep compat.** `zeta(-3)` stays `0.0083333333333335` (mathjs `0.0083333345772996`; the exact value is `1/120`). `zeta(complex(1,2))` stays finite. `zeta(bignumber(4))` stays the closer value to `π^4/90`. Under `number: 'BigNumber'`, `symbolicEqual('x*y','y*x')` stays `true` and `range('4:10')` stays the matrix that includes `10`. | These are wrong in mathjs. Copying them would be mathematically wrong. Document each in `docs/api/compat.md` under a heading `Intentional divergences`, with the mathjs value in the sentence. |
| #1586                      | **Match mathjs.** Under `number: 'Fraction'`, `parse('1/3 + 1/4').toString()` is `1/1 / 3/1 + 1/1 / 4/1`. `evaluate` stays `7/12`.                                                                                                                                                                                                            | The mathjs string is hard to read and is not a wrong value. The default is to match.                                                                                                           |
| #1568, #1569, #1570, #1571 | See G12.                                                                                                                                                                                                                                                                                                                                      | Typed packages are functions, not a mathjs instance.                                                                                                                                           |

### S5. Breaking-change ledger

Record each row in the root changelog bullet and in the changeset body as `BREAKING:`.

| Change                                                                                 | Before                                                                                                                    | After                                                                                                                                | Callers                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compat `evaluate` / `parser` / `compile` default                                       | Throws `Security: …` on assignment and on `simplify` / `parse` / …                                                        | Mathjs behavior                                                                                                                      | Anyone who caught the Security error to reject untrusted expressions on the **compat** instance. Pass `{ safe: true }`. The typed `evaluate` is unchanged.                                                                                                                                   |
| Block `evaluate` result (#1556)                                                        | `evaluate('1; 2')` returns `2` (unwrapped number) and `evaluate('1\n2')` returns `[1, 2]` (plain Array)                   | Returns `ResultSet` (`entries: [2]` / `[1, 2]`) on both compat and typed `evaluate`                                                  | Callers who read the return value of a multi-statement expression directly instead of `.entries` / `.valueOf()`.                                                                                                                                                                             |
| `version`                                                                              | `"0.7.25"` (the package)                                                                                                  | `"15.3.0"`                                                                                                                           | Code that read the compat package version from `math.version`. Read `compatVersion`.                                                                                                                                                                                                         |
| Factory return types (#1550, #1588)                                                    | `ones(2)` and `expm(Array)` return `Array`; `std(complex, 2)` and `variance(complex, 2)` return a real `number` magnitude | `ones(2)` and `expm(Array)` return `DenseMatrix` (under default `matrix: 'Matrix'`); `std`/`variance` of Complex return `Complex`    | Callers who assumed `Array.isArray(ones(2))`, `Array.isArray(expm(arr))`, or real `std(complex)`. Use `matrix: 'Array'` or `.toArray()` / `abs()`.                                                                                                                                           |
| Arity (#1587)                                                                          | `add(2)`, `size(2, 3)`, `transpose(2, 3)`, `bignumber(2, 3)`, `det(2, 3)`, `inv(2, 3)` return a value                     | Throw the mathjs `TypeError` (`Too few arguments` / `Too many arguments`)                                                            | Callers who passed extra arguments that were ignored.                                                                                                                                                                                                                                        |
| `sin(fraction)` and the same pattern for other trig functions                          | A Complex (Fraction converted through the typed table)                                                                    | Throw `Cannot implicitly convert a Fraction to BigNumber or vice versa…`, as mathjs does                                             | Callers who relied on the conversion. Use `number(fraction)` first.                                                                                                                                                                                                                          |
| bigint to number (#1566)                                                               | `add(-(2n ** 1100n), 0.5)` is `-Infinity`; `add(2n ** 60n, 0.5)` is a finite number past `2^53`                           | Throw `Cannot implicitly convert bigint to number: value is below the min safe integer value` / `exceeds the max safe integer value` | Callers who used the overflow as a sentinel. Convert with `bignumber` explicitly. This is `core`’s `bigintToNumber` (`core/src/typed/number-input.ts` line 42 is `Number(n)`), so every typed function that converts bigint to number changes. In-range bigints (`2n ** 40n`) still convert. |
| Sparse `dotPow` / `dotDivide` / `divide` by a scalar whose image of 0 is not 0 (#1565) | Stays sparse and drops the implicit zeros (`0^0` stored as 0)                                                             | Dense, with the zero entries evaluated (`[[1, 1]]`, `[[NaN, Infinity]]`)                                                             | Callers who checked `isSparseMatrix` on the result.                                                                                                                                                                                                                                          |
| `multinomial` of a matrix that is not a vector (#1563)                                 | Returns a number (`12600`)                                                                                                | Throws `RangeError: Dimension mismatch (2 != 1)`                                                                                     | Callers who passed a matrix of counts. Flatten first.                                                                                                                                                                                                                                        |
| `eigs` vectors and loose `precision` (#1561)                                           | Orthonormal vectors; precision ignored                                                                                    | mathjs scale and mathjs convergence                                                                                                  | Callers who depended on unit eigenvectors. Divide by the norm if you need that.                                                                                                                                                                                                              |
| `schur` order and `solveODE` steps (#1584)                                             | Opposite diagonal order; six steps                                                                                        | mathjs order; three steps for the repro                                                                                              | Golden files of `T` or of `t`.                                                                                                                                                                                                                                                               |
| Fraction `format` / `string` (#1579)                                                   | `format(fraction(2))` is `"2"`; `string(fraction(1,3))` is a float                                                        | `"2/1"` and `"0.(3)"`                                                                                                                | Snapshot tests of format.                                                                                                                                                                                                                                                                    |
| Fraction-config `ConstantNode.toString` (#1586)                                        | `"1 / 3 + 1 / 4"`                                                                                                         | `"1/1 / 3/1 + 1/1 / 4/1"`                                                                                                            | Code that parsed the expression text.                                                                                                                                                                                                                                                        |

`isPositive(fraction)` changing from `false` to `true` is a bug fix. Mention it in the changelog. It is not a supported contract.

### S6. Shared differential harness

Create `compat/tests/parity/oracle.ts`:

```ts
import { create, all, type MathJsInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';

export type OracleConfig = Record<string, unknown>;

export function pair(config: OracleConfig = {}): {
  mathjs: MathJsInstance;
  compat: ReturnType<typeof createCompat>;
} {
  return {
    mathjs: create(all, config) as MathJsInstance,
    compat: createCompat(compatAll, config),
  };
}

export function show(
  lib: { typeOf(v: unknown): string; format(v: unknown, o: { precision: number }): string },
  value: unknown
): string {
  return lib.typeOf(value) + ' ' + lib.format(value, { precision: 14 });
}
```

`compat/tests/parity/differential.ts` exports `expectSame(label, config, run)` where `run` receives one library. It catches on both sides. If both throw, the error name must match and the message must match through the first colon-terminated clause (bigint messages include the whole value; compare the prefix `Cannot implicitly convert bigint to number:` plus `below the min safe integer` or `exceeds the max safe integer`). If both return, `show` must be equal. A function result compares `typeof` and `.name` when the issue lists a name.

Intentional divergences are a map `INTENTIONAL` in `compat/tests/parity/intentional.ts`, keyed by issue number, each entry a function that asserts the compat value and a comment that quotes the mathjs value. `expectSame` is not used for those cases. #1585 is the only functional entry. No other issue is added to that map without a new decision in `docs/api/compat.md`.

The full harness from #1574 (every instance function × the 33-tuple pool, all 926 embedded-docs examples × default / `number:'BigNumber'` / `matrix:'Array'`, `toString` and `toTex`) lives in `compat/tests/parity/full-surface.test.ts`. It is added in G00 as a test that **fails the run** when a case is neither a match nor listed in `compat/tests/parity/known-gaps.json`. The JSON is an object `{ "1549": ["parser: x = 3", ...], ... }` seeded with the issue repro labels. Each group deletes its keys in the same commit as the fix. G21 fails CI if any key remains except `"1585"`. This file is new. It does not replace an existing test.

Embedded docs: read them from the mathjs package (`mathjs/lib/esm/expression/embeddedDocs` or the `docs` export). 926 examples is the tracker count. Assert the count in the test so a future mathjs that adds an example fails the oracle workflow rather than skipping it.

### S7. Changelog bullet shape

Insert under `## [Unreleased]` → `### Fixed` (or `### Changed` when the ledger row is breaking), as the new first bullet:

```markdown
- **<one-line title> (#<issues>):** <what was wrong, the mathjs 15.3.0 result, the file that changed>. BREAKING: <ledger sentence, only if S5 lists it>.
```

Changeset `summary` is that same paragraph. Package list is every package whose `src` changed.

### S8. Version bumps (#1573), without publishing

Each group that changes a public package adds one changeset naming that package. `functions` changes already pull `compat` via the existing dependency bump (`updateInternalDependencies: patch` in `.changeset/config.json`). Still name `compat` explicitly when compat’s own `src` changes, because a functions-only changeset does not describe the compat behavior.

G21 adds `tools/test/check-unpublished-surface.mjs`. For each public workspace package it compares `package.json` `version` with `npm view <name> version`. When they are equal, it downloads the registry tarball and compares `Object.keys` of the package entry with `Object.keys` of the local `dist` entry. A difference with no `.changeset/*.md` that names the package is a failure. When the versions differ, the script checks that a changeset names the package. The script does not run `npm publish`, `changeset publish`, or `git tag`. Wire it as a `node` script in the Compile & Lint job, after `bun run build`, next to the other `node tools/test/*.mjs` steps. Document the command in `AGENTS.md` in the tool-test list (one row). That is the only AGENTS edit.

The 29 names in #1573 (`isAccessorNode` through `isSymbolNode`, `num`, `den`) are already exported from `functions` on this HEAD (the issue compared npm 0.89.22 with main at the same version). G21’s script is what makes that class of drift fail. Do not re-export them again. The `string(fraction(1,3))` drift is fixed in G15, and that group’s changeset bumps `functions` and `compat`.

---

## Dependency graph

```text
G00 oracle pin
 ├─ G01 expression policy          ─┐
 ├─ G02 factory binding            ─┤
 ├─ G03 Fraction sign              ─┤
 ├─ G04 Unit BigNumber equality    ─┤
 ├─ G07 nullish                    ─┤
 ├─ G08 inverse hyperbolic         ─┤  these groups do not import each other
 ├─ G10 eigs                       ─┤
 ├─ G11 mathjs 15.3.0 behavior     ─┤
 ├─ G12 typed export decisions     ─┤
 ├─ G14 toTex                      ─┤
 ├─ G15 Fraction text              ─┤
 ├─ G16 version string             ─┤
 ├─ G17 SparseMatrix zeros         ─┤
 ├─ G18 intentional divergences    ─┤
 └─ G19 zpk2tf                     ─┘
        │
        ├─ G05 BigNumber pow / schur / solveODE   needs G02 (the instance pow/schur is the factory)
        ├─ G06 type preservation                  needs G02 (rebind first; fix what is still a number)
        ├─ G09 indexed assignment                 needs G01 (the repro assigns)
        └─ G13 expression.transform               needs G02 (the function objects) and G01 (the scope)
                 │
                 └─ G20 meta-API tests            needs G12, G13, G16
                          │
                          └─ G21 unpublished-surface CI   last; sees every changeset
```

**Parallel after G00 + G11:** G01, G03, G04, G07, G08, G10, G12, G14, G15, G16, G17, G18, G19. (G11 lands with or immediately after G00 on the same branch so the skip-budget CI gate stays green without skipping tests, and so G17 does not conflict with G11 on `matrix/src/types/SparseMatrix.ts`.)

**After G01:** G02 (avoids merge conflicts with G01 on `compat/src/index.ts`), G09.

**Parallel once G01 and G02 are green:** G05, G06, G13.

**Then:** G20, then G21.

**Shared-file coordination note:** `functions/src/factories/index.ts` is touched by G02, G10, G12, and G15 (disjoint export blocks — merge sequentially or rebase cleanly). `docs/api/compat.md` (G01, G05, G14, G15, G16, G18, G19), `docs/migration-guide.md` (G01, G12), `compat/tests/parity/known-gaps.json`, and `CHANGELOG.md` are additive/disjoint-section edits.

---

## G00 — Oracle pin

**Closes:** #1574. Severity P1.

**Root cause:** `compat/package.json` pins `mathjs` at 15.2.0 and `compat/src/parity-names.generated.ts` says so. Confirmed by reading the file. Confirmed again by `npm view mathjs version` → `15.3.0` and by the live process above. No export names were added; behavior changed in the four G11 functions.

**Files:**

- Modify: `compat/package.json` (the devDependency).
- Modify: `compat/scripts/gen-parity-names.mjs` (the comment it writes).
- Modify: `compat/src/parity-names.generated.ts` (regenerated).
- Create: `compat/tests/parity/oracle.ts`, `differential.ts`, `intentional.ts`, `full-surface.test.ts`, `known-gaps.json`.
- Create: `.github/workflows/mathjs-oracle.yml`.
- Test: `compat/tests/parity/oracle-version.test.ts`.

**Design:** S1 and S6. `known-gaps.json` starts with every issue id from #1549 to #1589 except #1574. Values are the repro labels copied from the issue bodies. #1585’s labels go to `intentional.ts` instead, not to the gap file.

- [ ] **Step 1: Write `oracle-version.test.ts`.** It reads `compat/package.json` and asserts the mathjs devDependency is `15.3.0`. It imports `mathjs` and asserts `create(all).version === '15.3.0'`.

- [ ] **Step 2: Run it.** `bunx vitest run compat/tests/parity/oracle-version.test.ts`. Expected: FAIL because the pin is `15.2.0`.

- [ ] **Step 3: Bump the pin, `bun install`, run `node compat/scripts/gen-parity-names.mjs`.** The generated header says 15.3.0. Run `node compat/scripts/gen-parity-names.mjs --check` and expect exit 0.

- [ ] **Step 4: Add the harness and the workflow.** Seed `known-gaps.json` from the issue repro labels. The full-surface test’s first run will fail on real mismatches; those labels must be in the JSON or the test fails. Run `bunx vitest run compat/tests/parity/full-surface.test.ts` and expect PASS only because every current mismatch is listed. A label that already matches must not be in the JSON: the test fails if a listed label matches, so the list cannot rot. (That is the mutation check for the allowlist. Do not weaken it later.)

- [ ] **Step 5: Run `bunx vitest run compat/tests`.** Failures outside the four 15.3.0 behavior changes go back into this step and get fixed without skipping. The four G11 files, if they fail, are updated in G11 in the next commits on this branch before the branch is considered green.

- [ ] **Step 6: Changelog and changeset** for `@danielsimonjr/mathts-compat`: “The compat parity oracle is mathjs 15.3.0 (#1574).” Not breaking.

**Done:**

- [ ] `mathjs` devDependency is 15.3.0 and `--check` on the generator passes.
- [ ] The workflow file exists and its `npm view` comparison is the dependency string.
- [ ] `known-gaps.json` contains only labels that still differ, and a matching label fails the test.
- [ ] No existing assertion was deleted.

---

## G01 — Compat expression policy

**Closes:** #1549, #1562, #1556, #1576, #1580. Severity P0 (#1549). The others in this group are P1 (#1556, #1562) and P2 (#1576, #1580). They share the evaluator and the scope object.

**Root cause (verified in source, and by the issue capture which quotes the `Security:` strings that `validateAst` throws):**

- `expression/src/evaluator/evaluate.ts` lines 51–62 and 87–108 reject assignment, function definitions, and `simplify` / `derivative` / `evaluate` / `parse` / `compile` / `help`.
- `expression/src/Parser.ts` line 116 never forwards options.
- `functions/src/factories/evaluate.ts` builds `mathScope` and `unsafeMathScope`. The unsafe scope still omits names in `EXPRESSION_SCOPE_OMIT`, and `help` is not a function in that scope (the issue’s unsafe repro throws `Undefined function "help"`).
- `compat/src/index.ts` binds `config` as the object returned by `mathFunctions.config()`.
- `expression/src/compiler/compile.ts` lines 593–596 unwrap a block.
- `FunctionAssignmentNode.ts` does not set `.name`.

**Mutation check:** the new test calls `create(all).evaluate('a = 2')`. On HEAD that throws `Security: assignment expressions are disabled`. The test expects `2`. It fails until the policy lands.

**Files:**

- Modify: `expression/src/evaluator/evaluate.ts` (add the policy flag; do not delete `validateAst`).
- Modify: `expression/src/compiler/compile.ts` `compileBlockNode`.
- Modify: `expression/src/node/FunctionAssignmentNode.ts`.
- Modify: `expression/src/utils/customs.ts` only if `getSafeMethod` rejects `evaluate` on a Node. Allow the methods `evaluate`, `compile`, `toString`, `toTex`, `toHTML`, `toMathML` on a value with `isNode === true`. Keep every other rejection.
- Modify: `functions/src/factories/evaluate.ts` so the scope used by compat includes `help`, `parser`, `compile`, `evaluate`, `simplify`, `derivative`, `parse`, `config`.
- Modify: `compat/src/instance-api.ts` and `compat/src/index.ts` (bind `config` the function; default policy mathjs; `{ safe: true }` selects the validator).
- Modify: `docs/migration-guide.md`, `docs/api/compat.md`, `compat/README.md`.
- Test: `compat/tests/parity/g01-expression-policy.test.ts`.
- Do not edit `expression/tests/security/sandbox.test.ts` except to add cases. Never remove a case.

**Design:** S3.

```ts
export type EvaluatePolicy = 'safe' | 'mathjs';

export interface EvaluateOptions {
  unsafe?: boolean;
  safe?: boolean;
  policy?: EvaluatePolicy;
}
```

Resolution: `safe: true` or the typed default → run `validateAst` and `sanitizeEvaluateResult`. `policy: 'mathjs'` or compat default → skip both. `{ unsafe: true }` on the typed API stays the opt-out it is today. Passing `safe: true` and `unsafe: true` throws `TypeError` before parse.

`compileBlockNode` returns `new ResultSetClass(results)` where `ResultSetClass` is `math.ResultSet`. If it is missing, throw `Error: ResultSet is not in the math scope` rather than returning a bare array. Add `ResultSet` to both scopes in `functions/src/factories/evaluate.ts`.

- [ ] **Step 1: Write the test** with one `it` per row of #1549, #1562, #1556, and #1580, using `expectSame`. Include `evaluate('f(x) = x^2; f(3)')` (ResultSet `[9]`), `parser` assigning `x = 3` then `x + 1`, `compile('a = 2').evaluate({})`, `simplify` and `derivative` inside `evaluate`, `evaluate('evaluate("2 + 3")')`, `help(sqrt)` (type `Help` or the format string; compare `show`), and the node method. Include `evaluate('1; 2') instanceof ResultSet` via a direct assertion on both libraries. Include `{ safe: true }` on compat expecting the existing Security error for `a = 2`, so the opt-in cannot rot.

- [ ] **Step 2: Run** `bunx vitest run compat/tests/parity/g01-expression-policy.test.ts`. Expected: FAIL on `Security:` and on `config is not a function` and on ResultSet.

- [ ] **Step 3: Implement** the policy, the scope binding, `compileBlockNode`, the function name, and the docs row.

- [ ] **Step 4: Run** the new test and `bunx vitest run expression/tests/security/sandbox.test.ts`. Both pass. Typed `evaluate('a = 2')` still throws. A one-line mutation that forces compat to call `validateAst` makes the new test fail; revert that mutation.

- [ ] **Step 5: Delete** the G01 labels from `known-gaps.json`.

- [ ] **Step 6: Changelog.** `### Changed`: `- **Compat expression policy matches mathjs by default (#1549, #1556, #1562, #1576, #1580):** Enabled assignment, function definitions, in-expression `simplify`/`derivative`/`parse`/`evaluate`/`compile`/`parser`/`help`/`config`, `ResultSet`block results, and declared function names on compat`create(all)`; opt-in hardening via `{ safe: true }`. Typed `evaluate`remains safe by default. BREAKING: compat`evaluate`/`parser`/`compile`no longer throw`Security:`by default (pass`{ safe: true }`to opt in), and multi-statement blocks return`ResultSet`on both compat and typed`evaluate`.` Changeset: `compat`, `expression`, `functions`.

**Done:**

- [ ] All nine #1549 rows match, including `help` and the node method.
- [ ] `config()` inside an expression returns the object and applies `{number: "Fraction"}` to that instance only.
- [ ] `evaluate('1; 2')` and `evaluate('1\n2')` are ResultSets with mathjs entries.
- [ ] `evaluate('isOdd(x) = x % 2').name` is `isOdd`.
- [ ] The migration-guide row no longer says mathjs evaluate is sandboxed.
- [ ] `expression/tests/security/sandbox.test.ts` still passes without a removed assertion.
- [ ] `{ safe: true }` still throws the Security error.

---

## G02 — Bind the mathjs factories

**Closes:** #1550. Also the part of #1587, #1588, and #1583 that is only “the instance points at the wrong function”. Severity P0.

**Root cause:** `compat/src/index.ts` maps `ceil: shims.ceil`, `identity: shims.identity`, `ones: shims.ones`, `std: shims.std`. `identity` (`compat/src/shims.ts` line 636) takes one number and calls `DenseMatrix.identity(n)`, so `identity(2, 3)` is 2×2 and `identity(7, 2)` is 7×7. `ceil` is the typed one-argument function, so the second argument throws `Too many arguments`. The expression path already calls the factory, which is why `evaluate('ceil(3.14159, 2)')` matches and the method call does not. Confirmed by reading those lines. The issue capture is the runtime evidence.

**Files:**

- Modify: `compat/src/index.ts` (the map and the named exports).
- Modify: `compat/src/shims.ts` (delete a shim only when nothing else imports it; if a test imports the shim module, update the test to import the instance).
- Modify: `functions/src/statistics/std.ts` and `functions/src/statistics/variance.ts` for Complex results (`std(complex(1,2), 2)` is `0.70710678118655 - 1.4142135623731i`).
- Modify: `functions/src/arithmetic/ceil.ts` (and floor, fix, round) only if the factory still lacks `(x, n)` or Unit. The issue says `factory_ceil(3.14159, 2)` is already `3.15`. Re-check before editing.
- Modify: the `expm` factory (`functions/src/factories/index.ts` re-exports `matrixExpm`) so an Array returns a DenseMatrix (#1588). Do not wrap in compat.
- Modify: `functions/src/statistics/mad.ts` so `mad(unit('5 cm'), unit('2 inch'))` is `0.015748031496063 inch`, not `400 um` (#1583). The unit of the result is the unit mathjs keeps (the second argument’s unit in this call). Match the oracle on a list of mixed units, not a hard-coded `inch`.
- Test: `compat/tests/parity/g02-factories.test.ts` covering every row of the #1550 table, plus the #1587 rows that are arity (`add(2)`, `multiply(2)`, `size(2,3)`, `transpose(2,3)`, `bignumber(2,3)`, `det(2,3)`, `inv(2,3)`, `sin(fraction(1,3))`, BigNumber-config `erf(0.2)`), `count(true)` which must return `4` and today throws, and the two `expm` rows and two `mad` rows.

**Design:** S2. Arity comes from the factory’s typed-function signatures. Do not wrap the factory in a function that counts arguments. If the factory accepts `add(2)`, remove the one-argument signature in `functions/src/arithmetic/add.ts` (the mathjs factory) so the typed dispatcher throws `Too few arguments in function add`. Same for `multiply` and `subtract`. `count(true)` returns `4` and `count(false)` returns `5` in mathjs because mathjs’s `typed-function` converts `boolean -> string` (`'true'.length === 4`, `'false'.length === 5`); `functions/src/matrix/count.ts` already has `{ string, 'Matrix | Array' }`. Add the `boolean -> string` conversion in the compat typed instance (or `core/src/typed/mathts-typed.ts` if mathjs-compatible across the board) rather than hard-coding a `boolean => 4` shim, and test both `count(true) === 4` and `count(false) === 5`.

`size(2, 3)` must throw `Too many arguments in function size (expected: 1, actual: 2)`. The factory signature is one argument. A rest parameter is the bug; delete it.

`sin(fraction(1,3))` throws the Fraction/BigNumber conversion error. The conversion table must not convert Fraction to Complex or number for `sin`. If the typed `sin` has a `Fraction` signature that computes a number, remove it and let the missing conversion throw the mathjs error. Check `acos`, `acosh`, `acot`, `acoth`, `acsc`, `asec`, `asech`, `asin`, `asinh`, `atan`, `atan2`, `atanh`, `cos`, `cosh`, `cot`, `coth`, `csc`, `csch`, `sec`, `sech`, `tan`, `tanh`, `log`, `log10`, `log2`, `exp` the same way: a Fraction argument throws, matching mathjs. A test loops those names with `fraction(1,3)`.

BigNumber-config `erf(0.2)` throws in mathjs (`Unexpected type of argument … actual: BigNumber`). The literal `0.2` is a BigNumber under that config. The factory must not add a BigNumber signature for `erf` unless mathjs has one. Same rule for `gamma` and `random` as listed in #1587. The full-surface harness is the net; this group’s test is the repro table plus the name loop.

- [ ] **Step 1: Write the test** from the #1550 table and the extra rows above. Use `expectSame`.

- [ ] **Step 2: Run it.** Expected: FAIL, first failure `Too many arguments in function ceil`.

- [ ] **Step 3: Rebind.** Then fix `std` / `variance` / `mad` / `expm` / `add` arity / `count` / Fraction trig in the factories until the test passes. After each file, re-run the test.

- [ ] **Step 4: Run** `bunx vitest run compat/tests/parity/g02-factories.test.ts` and `bunx vitest run functions/tests/statistics` (or the package test that covers `std`). Existing tests that expect `std(complex)` to be a real magnitude get the expected value updated to the Complex, with a comment citing #1550. Do not delete the test.

- [ ] **Step 5: Remove** the #1550, #1587, #1588, #1583 labels that now match from `known-gaps.json`.

- [ ] **Step 6: Changelog.** `### Changed`: `- **Compat binds mathjs-shaped factories (#1550, #1583, #1587, #1588):** Bound `create(all)`and compat named exports to`functions` factories (`ceil`/`floor`/`fix`/`round`, `identity`, `ones`, `std`, `variance`, `mad`, `expm`, `count`) and aligned arity and Fraction-trig rejections with mathjs 15.3.0. BREAKING: extra/missing arguments and trig on Fractions now throw matching mathjs `TypeError`s; `ones(n)`and`expm(Array)`return`DenseMatrix`; `std`/`variance`of Complex return`Complex`.` Changesets: `compat`, `functions`, `matrix` if `expm` lives there.

**Done:**

- [ ] Every #1550 row matches, on the instance and on the named export.
- [ ] A comment remains on every shim that is still in the map.
- [ ] `count(true)` is `4`.
- [ ] `expm([[0,2],[0,0]])` is a DenseMatrix.
- [ ] `mad(unit('5 cm'), unit('2 inch'))` formats as the mathjs unit string.
- [ ] No new shim file.

---

## G03 — Fraction sign fields

**Closes:** #1551. Severity P0.

**Root cause:** `functions/src/utils/isPositive.ts` line 81 is `x.s > 0n && x.n > 0n`. `functions/src/utils/isNegative.ts` line 78 is `x.s < 0n`. `core/src/types/fraction.ts` stores `numerator` and `denominator` (bigint) and already has `isPositive()` / `isNegative()` at lines 690–699. `x.s` is `undefined`, and the comparison is false for every Fraction. `isZero` uses a path that works (the issue shows `isZero(fraction(0))` is true). Confirmed by reading both files.

**Files:** Modify the two utils. Add `functions/tests/fraction-sign-fields.test.ts` which reads the two source files as text and fails if a Fraction signature contains `.s`, `.n`, or `.d`. Add `compat/tests/parity/g03-fraction-sign.test.ts` with the five repro rows plus a DenseMatrix of Fractions.

**Design:** Call `x.isPositive()` and `x.isNegative()`. Do not read `numerator` in the util if the method exists; the method is the API. Grep `functions/src` for `x.s` and `x.n` on values typed as Fraction and fix every hit the same way. `fraction.js` field names in a comment are fine.

- [ ] **Step 1: Write both tests.** The differential one expects `true`, `true`, `false`, `[true, false]`, `true`.

- [ ] **Step 2: Run them.** The differential test fails (`false` vs `true`). The source test fails on line 81.

- [ ] **Step 3: Change the two signatures.** Re-grep.

- [ ] **Step 4: Run the tests.** Pass. Mutate `isPositive` back to `x.s > 0n` and confirm the test fails; restore.

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Fraction sign predicates (#1551):** `isPositive`and`isNegative`now call`Fraction.isPositive()`/`Fraction.isNegative()`instead of reading undefined`fraction.js`fields`.s`/`.n`.` Patch changeset for `functions` and `compat`. Not in the breaking ledger.

**Done:**

- [ ] Scalar, array, and matrix of Fractions match mathjs for `isPositive`, `isNegative`, and `isZero`.
- [ ] The source scan fails on `.s` / `.n` / `.d` inside those files.

---

## G04 — Unit equality with BigNumber values

**Closes:** #1552. Severity P1.

**Root cause:** `functions/src/relational/compareUnits.ts` lines 19–26 compare `unitX.value` to `unitY.value` after `equalBase`, with no conversion to a common unit. `functions/src/typed/relational.ts` `compareUnits` (lines 442–459) does the same. `Unit.equals` (`core/src/types/unit/Unit.ts` lines 1737–1738) does the same. Subtraction of `50cm` and `0.5m` is `0 m` because the unit arithmetic path converts (the issue’s fifth row matches). The compare path never calls `Unit.prototype.to`. Number-mode equality matches because those units are stored already reduced; BigNumber units keep `50` in `cm` and `0.5` in `m`. Confirm that storage in step 1 by printing `.value` and `.formatUnits()` (or `toString()`) under both configs before changing code. If the print shows both number units already in metres and both BigNumber units still prefixed, the compare fix is necessary and a second fix is not. If BigNumber units are also stored in metres, the bug is inside `equal` of the BigNumber values (a reference compare); fix that instead and write the evidence in the PR.

**Files:** `functions/src/relational/compareUnits.ts`, `functions/src/typed/relational.ts`, `core/src/types/unit/Unit.ts` `equals`, and the larger/smaller/largerEq/smallerEq factories if they use the same helper. Test: `compat/tests/parity/g04-unit-equal.test.ts`.

**Design:** Convert both units to the base unit with the same `to` path subtraction uses, then `equalScalar` on the two values. `50cm == 0.5m` is true, `!=` is false, `1m == 100cm` is true, for number and BigNumber values. Unequal pairs stay false (`50cm == 0.6m`). Different dimensions still throw. A prefix-only difference (`1 cm == 10 mm`) is true.

- [ ] **Step 1: Write the test** for `equal`, `unequal`, `equalScalar`, `deepEqual`, `larger`, `smaller`, `largerEq`, `smallerEq` on the three issue expressions plus `equal(unit(bignumber(50),'cm'), unit(bignumber(0.5),'m'))` and the number-mode twins.

- [ ] **Step 2: Run.** Expected: FAIL on the BigNumber rows, PASS on the number-mode rows. If a number-mode row fails, stop and fix that too; the issue says number mode works.

- [ ] **Step 3: Implement the conversion in one helper** used by both compareUnits copies and by `Unit.equals`. Do not copy the conversion into each relational function.

- [ ] **Step 4: Re-run.** Then `bunx vitest run core/tests` filtered to unit tests, and the functions relational tests. Existing assertions stay.

- [ ] **Step 5: Gaps, changelog, changeset.** `### Fixed`: `- **BigNumber Unit equality (#1552):** Normalized both units to a common base before scalar comparison in `compareUnits`and`Unit.equals`so`50cm == 0.5m`is`true`under`number: 'BigNumber'`.` Patch changeset for `core`, `functions`, `compat`. Not in the breaking ledger.

**Done:**

- [ ] The five issue rows match.
- [ ] Prefix pairs and dimension mismatches match mathjs.
- [ ] One helper, not three copies.

---

## G05 — BigNumber matrix power, schur, lyap, solveODE

**Closes:** #1553 (P1), #1584 (P2). Depends on G02 so the instance calls the factories.

**Root cause:**

- `matrix/src/types/DenseMatrix.ts` rejects a nested array whose entry is not a number (`must contain numbers`, the line that mentions `typeOf(value)`). BigNumber-config `pow([[1,2],[4,3]], 2)` builds that array. The oracle cell is a BigNumber (`Decimal`, `typeOf` `BigNumber`, string `9`).
- `functions/src/algebra/decomposition/schur.ts` line 113 throws `schur: only real (number) matrices are supported`. `sylvester` and `lyap` call it.
- For #1584, the number-matrix schur sorts the diagonal differently and flushes the subdiagonal to 0. mathjs leaves `5.147e-118` and puts `5.372…` in `T[0][0]`. `solveODE` picks a different first step (`0.6029029729200805`, three samples versus six). The files are `matrix/src/operations/schur.ts` and `functions/src/numeric/solveODE.ts` (the issue’s guess). The factory schur is `functions/src/algebra/decomposition/schur.ts`. Step 1 prints which function `create(all).schur` is (`.name` or a unique throw) so the edit hits the function the instance calls.

**Design:**

- Matrix `pow` accepts a BigNumber (and a number) matrix and returns a DenseMatrix of BigNumbers when the input entries are BigNumbers. Compute with the BigNumber arithmetic the factory already uses for scalars, or convert each entry with the mathjs rule and convert back. The test checks `typeOf` of `get([0,0])`, not only `format` of the matrix. The formatted matrix is `[[9, 8], [16, 17]]`.
- `schur` of a BigNumber matrix returns the mathjs BigNumber result for the #1553 inputs (the captured matrices are the number-looking format of those BigNumbers; assert entry type).
- Ordering: sort the real Schur form the way mathjs does (largest real part of the diagonal first for this 2×2) and do not replace a subdiagonal below 1e-100 with 0. Match the oracle string at precision 14, including the `5.1470165474828e-118` entry.
- `solveODE`: set the initial step to the mathjs formula. The test pins `t.length`, `t[1]`, and `y.at(-1)` against the oracle, so the formula is whatever produces `0.6029029729200805` on this problem. Read mathjs `solveODE` in `node_modules/mathjs` and port the step-size initialization into `functions/src/numeric/solveODE.ts`. Do not hard-code `0.6029`. Invariants `A = U T Uᵀ` within 1e-8 and the ODE error within the default tolerance stay as extra assertions; they do not replace the oracle compare.

- [ ] **Step 1: Tests** `compat/tests/parity/g05-bignumber-matrix.test.ts` (the three #1553 expressions, entry type BigNumber) and `g05-schur-ode.test.ts` (the three #1584 rows).

- [ ] **Step 2: Run.** Both fail.

- [ ] **Step 3: Widen DenseMatrix construction** used by `pow` so a BigNumber entry is legal, and widen `schur.ts` to accept a BigNumber matrix by converting through the same entries the oracle returns. Then align ordering and the ODE step.

- [ ] **Step 4: Run the tests** and `matrix` / `functions` schur tests. If an existing test pins the old diagonal order, update the expected matrix and cite #1584. Keep the reconstruction assertion (`U*T*U^T`).

- [ ] **Step 5: Gaps, docs, and changelog.** Record the #1584 decision (match mathjs `schur` ordering and `solveODE` step selection) in `docs/api/compat.md`. `### Changed`: `- **BigNumber matrix pow/schur/lyap and schur/solveODE parity (#1553, #1584):** Enabled BigNumber matrices in `pow`, `schur`, `sylvester`, and `lyap`, and aligned `schur`diagonal ordering and`solveODE`initial step selection with mathjs 15.3.0. BREAKING:`schur`diagonal order and`solveODE` step grid now match mathjs 15.3.0.` Changesets: `matrix`, `functions`, `compat`.

**Done:**

- [ ] The three BigNumber expressions match, including entry type.
- [ ] `schur` `T` and the ODE `t` / final `y` match the oracle at precision 14.
- [ ] Reconstruction and a tolerance check still exist.

---

## G06 — Keep BigNumber and Fraction results

**Closes:** #1554. Severity P1. Depends on G02.

**Root cause:** The typed implementations ignore `config.number` and the input type. `pinv` (`matrix/src/operations/pinv.ts`) only lists number and matrix signatures, so a BigNumber becomes a number and a Complex throws. `bernoulli` of a Fraction returns a number. `unaryPlus` of `true` and of `"2"` under BigNumber config returns a number. `compare(2, 3)` under that config returns a number `-1` instead of a BigNumber. The issue names `functions/src/typed/arithmetic.ts` and `functions/src/typed/probability.ts`. After G02 the instance may already call factories. Re-run the repro first. Fix whatever function the instance still calls. Do not wrap it.

**Design:** `pinv(bignumber('2.5'))` is BigNumber `0.4`. `pinv(fraction(1,3))` is Fraction `3/1`. `pinv(complex(1,2))` is Complex `0.2 - 0.4i`. `bernoulli(fraction(12))` is Fraction `-691/2730`. Under `number: 'BigNumber'`, `+true` is BigNumber `1`, `+"2"` is BigNumber `2`, `compare(2, 3)` is BigNumber `-1`, `pinv(4)` is BigNumber `0.25`, `bernoulli(4)` is BigNumber `-0.033333333333333`. The factory reads `config.number` for a numeric literal that arrived as a number only when the call went through `evaluate`. A direct `pinv(bignumber)` keeps BigNumber because the argument is a BigNumber, not because of the config.

- [ ] **Step 1: Test** `compat/tests/parity/g06-numeric-type.test.ts` with those rows.

- [ ] **Step 2: Run.** Expected: FAIL on type name (`number` vs `BigNumber`, and the Complex throw).

- [ ] **Step 3: Add the factory signatures** in the owning `createPinv` / `createBernoulli` / `createUnaryPlus` / `createCompare`. A Complex `pinv` of a scalar is `1/z`. A Fraction `bernoulli` uses the exact rational the mathjs factory returns. Do not call `Number()` and wrap the result.

- [ ] **Step 4: Re-run** plus the existing pinv tests. #1040’s matrix-with-Complex case stays.

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Preserve BigNumber/Fraction/Complex types (#1554):** Updated `pinv`, `bernoulli`, `unaryPlus`, and `compare`to preserve BigNumber, Fraction, and Complex inputs and`config.number`instead of collapsing to`number`.` Patch changesets: `functions`, `matrix`, `compat`.

**Done:**

- [ ] Every row matches type and format.
- [ ] Direct calls and `evaluate` calls are both in the test.

---

## G07 — `nullish` must not convert Fraction

**Closes:** #1555. Severity P1.

**Root cause:** `functions/src/typed/logical.ts` lines 206–224 list `number`, `bigint`, `BigNumber`, `Complex`, `boolean`, `string`, then `any, any`. There is no `Fraction, any`. The typed-function conversion table converts Fraction to Complex before `any`, so `nullish(fraction(1,3), 2)` is `Complex 0.333…`. `null` and `Unit` hit `any` and work.

**Design:** Add `'Fraction, any'` and `'Unit, any'` that return the first argument. Put them next to the other concrete signatures. The `??` operator uses this function (`expression/src/transform/nullish.transform.ts`); it picks up the signature if it calls the same `nullish`. If the transform has its own typed copy, add the same signatures there. A non-nullish first argument is returned with no conversion, for number, bigint, BigNumber, Fraction, Complex, Unit, string, boolean, Array, Matrix, and a function. `null` and `undefined` return the second argument unchanged.

- [ ] **Step 1: Test** `compat/tests/parity/g07-nullish.test.ts` with the four issue rows and the extra types.

- [ ] **Step 2: Run.** FAIL on the Fraction rows.

- [ ] **Step 3: Add the signatures.**

- [ ] **Step 4: Re-run.** Mutation: delete the Fraction signature, test fails, restore.

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Preserve Fraction and Unit in `nullish`(#1555):** Added explicit`Fraction, any`and`Unit, any`signatures to`nullish` so non-nullish Fractions are not converted to Complex.` Patch changesets: `functions`, `compat`.

**Done:**

- [ ] No Fraction row returns a Complex.
- [ ] `nullish(null, fraction(1,2))` is the Fraction.

---

## G08 — Inverse hyperbolic special values

**Closes:** #1558, #1559, #1560. Severity P1.

**Root cause:**

- `acsch` Complex signature calls `x.acsch()` (`functions/src/trigonometry/acsch.ts` lines 50–52). `core/src/types/complex.ts` has no `acsch`. The throw is `x.acsch is not a function`. The number path uses `acschNumber` and matches.
- `acoth(0)`, `acsc(0)`, `asec(0)` return Complex `NaN + NaNi`. mathjs returns `1.5707963267949i`, `Infinityi`, `Infinityi`. The number kernels in `functions/src/plain/number/trigonometry.ts` send `1/x` through a Complex path. The live oracle confirms the mathjs strings.
- `asech(7.25)` is the conjugate (`+1.4324241494098i` instead of `-1.4324241494098i`). `asech(complex(2,0))` is also the conjugate. `asech(2)` and `asech(-2)` match. The branch cut is in `functions/src/trigonometry/asech.ts` via `Complex` `acosh`.

**Design:** Implement `acsch` for Complex as `asinh(1/x)` using `Complex` methods that exist (`inverse` or `div`, and `asinh`). Do not add a method that only `acsch.ts` calls if `asinh(1/x)` is enough. If other trig files call `x.<fn>()` for a missing method, fix those calls in this group. The static test walks `functions/src/trigonometry` for `.acsch(`, `.asech(`, `.acoth(`, `.acsc(`, `.asec(` on a parameter and fails when `core/src/types/complex.ts` has no such method. Either add the method on `Complex` and use it, or stop calling it. One of the two, not a `try/catch`.

For the zeros: special-case `x === 0` in the number kernels to the mathjs values before the reciprocal. BigNumber `0` as well. `acot(0)` already matches and must stay a real `π/2`.

For `asech`: negate the imaginary part when the real input is `> 1`, and match `asech(complex(2,0))` which is `+1.0471975511966i` (a tiny real part `5.55e-17` formats away at precision 14). Do this in the branch-cut code, not by flipping the sign of one constant in the test. Check `acosh` and `asec` on both sides of their cuts in the same test so a flip does not fix `asech` and break `acosh`.

- [ ] **Step 1: Test** `compat/tests/parity/g08-inv-hyperbolic.test.ts`: the issue rows, plus ±1, ±Infinity, and NaN for `acoth`, `acsc`, `asec`, `asech`, `acsch`, `acosh`, `asinh`, `atanh` on number, BigNumber, and Complex. Signed zero on the imaginary part is compared through `format` precision 14, which is what the issue uses.

- [ ] **Step 2: Run.** FAIL on `NaN`, on the conjugate, and on `x.acsch is not a function`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Re-run** and the existing trigonometry tests (#729 / #728). Keep their Complex-domain assertions.

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Inverse trig/hyperbolic special values and Complex `acsch`(#1558, #1559, #1560):** Fixed`acoth(0)`, `acsc(0)`, `asec(0)`, `asech`branch cut for`x > 1`, and Complex `acsch` to match mathjs 15.3.0.` Patch changesets: `functions`, `core` if `Complex` gained a method, `compat`.

**Done:**

- [ ] The issue tables match.
- [ ] The static method-call test passes.
- [ ] `acot(0)` is unchanged.

---

## G09 — Indexed assignment that grows a matrix

**Closes:** #1557. Severity P1. Depends on G01 (the repro assigns).

**Root cause:** Direct `subset(matrix([]), index(1, [0, 1]), [5, 6])` already matches (`[[0, 0], [5, 6]]`). The expression `e = []; e[1, 1:2] = [5, 6]; e[2, :] = [7, 8]` ends as `[7, 8]`. The assignment path (`expression/src/node/AssignmentNode.ts` and the subset it calls) replaces the matrix with the row instead of resizing to 2-D. Confirm in step 1 by logging the matrix after the first assignment only. The issue suspects `functions/src/factories/matrix-bridge.ts`.

**Design:** The first assignment resizes `[]` to a 2×2 matrix padded with 0, equal to `subset(matrix([]), index(1, [0, 1]), [5, 6])`. The second writes row 2. The result is DenseMatrix `[[5, 6], [7, 8]]`. Ranges and `:` grow 1-D and 2-D the same way `subset` does. Fix the assignment node so it calls that `subset`, including the default pad. Do not special-case the literal `[5, 6]`.

- [ ] **Step 1: Test** `compat/tests/parity/g09-resize-assign.test.ts` with the three issue rows and one more: a 1-D growth `a = []; a[3] = 4` against the oracle.

- [ ] **Step 2: Run.** The expression row fails. The two `subset` rows pass. If a `subset` row fails, fix `subset` too.

- [ ] **Step 3: Point the index assignment at the subset implementation** that already passes the direct test.

- [ ] **Step 4: Re-run.**

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Auto-resize matrix on indexed assignment (#1557):** Routed indexed assignment in `AssignmentNode`through the resizing`subset` path so growing an empty matrix matches mathjs 15.3.0.` Patch changesets: `expression` or `functions`, and `compat`.

**Done:**

- [ ] The expression result is `[[5, 6], [7, 8]]`.
- [ ] Direct `subset` rows still match.

---

## G10 — `eigs` precision and vector scale

**Closes:** #1561. Severity P1.

**Root cause:** The public export is not `createEigs`. `functions/src/factories/index.ts` lines 1521–1534 replace it with `correctEigs` / `correctEigsOfMatrix` because the comment says the mathjs factory is wrong for non-symmetric matrices. `correctEigs` (`functions/src/matrix/native-accel.ts`) types options as `{ eigenvectors?: boolean; matricize?: boolean }` and never reads `precision`. `nativeEigs` returns the orthonormal vectors of `eig`. mathjs `eigs([[1,2],[3,4]], 2).values` is `[0, 5]` (live process). mathjs `eigs([[4,1],[2,3]]).eigenvectors[1].vector` is about `[1.7888543819998, 1.7888543819998]`, not the unit vector. The factory file `functions/src/matrix/eigs.ts` does pass `precision` into `computeValuesAndVectors` (lines 315–337). The public wrapper never calls that with the numeric matrix, because `asNumberSquare` succeeds and the native path returns first.

**Design:** The name `eigs` is the mathjs algorithm. Fix `functions/src/matrix/eigs.ts` until a differential test against mathjs 15.3.0 passes for symmetric, non-symmetric, and complex spectra, including `precision` as a number, a BigNumber, and `{precision, eigenvectors: false}`. Then set the public export to that function and stop routing numeric matrices through `correctEigs`. Keep `eig` in `@danielsimonjr/mathts-matrix` as the numerically different solver; it is a different symbol. If an existing test asserts the unit vector, change the expected vector to the mathjs vector and cite #1561. Keep the residual check `A*v ≈ λ*v` if one exists; do not delete it.

`eigs([[1,2,3],[4,5,6],[7,8,9]], {precision: 1e-6, eigenvectors: false}).values` must match the oracle order and values at precision 14, including the `2.02e-10` entry.

- [ ] **Step 1: Test** `compat/tests/parity/g10-eigs.test.ts` with the three issue rows. Compare `values` and the named vector with `expectSame`.

- [ ] **Step 2: Run.** FAIL on `[0, 5]` vs the high-precision pair, and on the vector.

- [ ] **Step 3: Repair `createEigs` and rebind the export.** Delete the bypass, or leave `correctEigs` only as a private helper that no public name calls. Do not scale a unit vector by `1.788…` as a constant.

- [ ] **Step 4: Re-run** and the eigs tests under `functions/tests`. Update expected vectors that #1561 proves wrong.

- [ ] **Step 5: Gaps and changelog.** `### Changed`: `- **`eigs`precision and eigenvector scaling (#1561):** Repaired`createEigs`and removed the`correctEigs`public bypass so`eigs`honors`precision`and matches mathjs 15.3.0 eigenvector scaling. BREAKING:`eigs`eigenvectors are no longer unit-normalized and loose`precision` options now take effect.` Changesets: `functions`, `compat`.

**Done:**

- [ ] The three rows match.
- [ ] `correctEigs` is not on the public path.
- [ ] A residual assertion remains somewhere in the eigs tests.

---

## G11 — mathjs 15.3.0 behavior changes

**Closes:** #1563, #1564, #1565, #1566. Severity P1. Land with or immediately after G00.

**Root cause:**

- `multinomial` (`functions/src/typed/probability.ts` lines 452–460) accepts only `Array | Matrix`, and `collectMultinomialParts` rejects a `0` (`entry >= 1`). mathjs 15.3.0 takes varargs (`multinomial(2, 3)` is `10`), accepts zeros (`[2, 0, 1]` is `3`), `multinomial(2)` is `1`, `multinomial([])` is `1`, and a 2-D matrix throws `RangeError: Dimension mismatch (2 != 1)`. The typed function returns `12600` for that matrix.
- `catalan` (`functions/src/combinatorics/catalan.ts`) has `'number | BigNumber'` only. A bigint is converted and rounded. `catalan(30n)` must be the bigint `3814986502092304`. `catalan(40n)` is `2622127042276492108820n`. `catalan(30)` stays the number `3.8149865020923e+15`.
- Sparse element-wise ops skip implicit zeros (`matrix/src/types/SparseMatrix.ts` uses `!== 0` in several loops, and the arithmetic factories `dotPow.ts`, `dotDivide.ts`, `divide.ts` use sparse algorithms that do not visit zeros). `0^0` stays 0. mathjs 15.3.0 returns a DenseMatrix `[[1, 1]]`, `[[NaN, Infinity]]`, `[[NaN, Infinity]]`.
- `bigintToNumber` (`core/src/typed/number-input.ts` line 42) is `Number(bigint)`, which is `Infinity` past `2^1024` and a rounded finite number past `2^53`. mathjs throws outside the safe-integer range. Live process: `add(-(2n**60n), 0.5)` throws, and the message starts `Cannot implicitly convert bigint to number: value is below the min safe integer value` or `exceeds the max safe integer value`.

**Design:**

- `multinomial`: one implementation used by the typed export and the factory. Varargs of numbers, a single array, zeros, empty, BigNumber entries. A matrix whose size is not a vector throws `RangeError` with `Dimension mismatch`. Port the 15.3.0 formula from `node_modules/mathjs` (overflow-safer product). Do not pre-check `>= 1` and then catch.
- `catalan`: a `bigint` signature that runs the exact division recurrence in bigint and returns bigint. Number and BigNumber paths stay. `catalan(30n)` must not go through `BigNumber`.
- Sparse: before applying an element-wise op of a sparse matrix and a scalar, test the scalar at `0`. If the result is not `0` (and not “still implicit”), evaluate every entry and return a DenseMatrix, matching mathjs. Do this in the shared sparse element-wise helper so `dotPow`, `dotDivide`, and `divide` cannot drift. Audit other element-wise sparse ops the same way (`dotMultiply` of a non-zero scalar must keep zeros as zeros; `dotPow(sparse, 1)` stays sparse). The test includes a control that must stay sparse.
- `bigintToNumber`: if the bigint is `< BigInt(Number.MIN_SAFE_INTEGER)` or `> BigInt(Number.MAX_SAFE_INTEGER)`, throw `TypeError` with the mathjs message, including the value. `add(2n ** 53n, 0.5)` throws. `add(2n ** 40n, 0.5)` returns a number and matches mathjs. This changes every conversion. Run `core` typed-function tests and fix expectations that used the old overflow, citing #1566, without deleting the test.

- [ ] **Step 1: Tests** `compat/tests/parity/g11-15-3-behavior.test.ts` with every row of the four issues, plus `dotPow(sparse, 1)` as the sparse control and `add(2n ** 40n, 0.5)` as the in-range control.

- [ ] **Step 2: Run.** FAIL on all four issues. The controls may already pass.

- [ ] **Step 3: Implement** in the four places named above.

- [ ] **Step 4: Re-run** and the package tests those files already have (`#1093`, `#1102`, `#1347`). Update expected values that described 15.2.0. Do not delete them.

- [ ] **Step 5: Gaps and changelog.** `### Changed`: `- **mathjs 15.3.0 behavior parity (#1563, #1564, #1565, #1566):** Updated `multinomial`(varargs, zeros, 2-D Dimension mismatch throw),`catalan(bigint)` (exact bigint), sparse element-wise ops (`dotPow`/`dotDivide`/`divide`evaluate implicit zeros), and`bigintToNumber`safe-integer range checks. BREAKING: out-of-range bigint-to-number conversions and 2-D`multinomial`inputs now throw; sparse`dotPow`/`dotDivide`/`divide`with non-zero image of 0 return`DenseMatrix`.` Changesets: `core`, `functions`, `matrix`, `compat`.

**Done:**

- [ ] All four issue tables match.
- [ ] The two controls match.
- [ ] `bigintToNumber` is the only conversion implementation (grep for `Number(n as bigint)` and for `Number(bigint`).

---

## G12 — Typed-package surface decisions

**Closes:** #1567, #1568, #1569, #1570, #1571. Severity P1 (#1567–#1570) and P2 (#1571).

**Root cause:** The typed entry files export factories and uppercase constants. The classes exist (`functions/src/error/ArgumentsError.ts`, `core/src/error/DimensionError.ts`, `core/src/error/IndexError.ts`, duplicates under `functions/src/error` and `expression/src/error`, `ResultSet` only as `isResultSet`, matrix helpers under `functions/src/type/matrix/`). Events exist only on the compat instance (`compat/src/instance-api.ts` lines 169–173). `docs` is `expression/src/embeddedDocs/embeddedDocs.ts` and is not exported. The 261 `create*` factories and 371 `*Dependencies` bundles are built in `compat/src/native-factory-exports.ts` and `compat/src/all-factories.ts`.

**Decisions:**

- **#1567 — export, and delete the duplicates.** One `DimensionError` and one `IndexError`, from `@danielsimonjr/mathts-core`. `functions` and `expression` import those. `ArgumentsError` from `@danielsimonjr/mathts-functions`. `ResultSet` from `@danielsimonjr/mathts-expression` (the class G01’s compiler uses). `FibonacciHeap`, `ImmutableDenseMatrix`, and `Spa` from `@danielsimonjr/mathts-functions`. `add([1,2],[1,2,3])` throws the core `DimensionError` (or the mathjs error type the oracle uses; assert `instanceof` the exported class on both the functions import and the compat instance). Remove the extra class declarations so a second copy cannot be constructed.
- **#1568 — compat only.** mathjs events are per instance, not module exports. Do not add `on` / `off` / `once` / `emit` to `@danielsimonjr/mathts-functions`. Document that in `docs/migration-guide.md` with the sentence: the typed packages export functions; `on`, `off`, `once`, and `emit` exist on `create(all)` from `@danielsimonjr/mathts-compat`, and `config` and `import` fire there. The export test asserts the four names are absent from `functions` and present on the compat instance.
- **#1569 — export `docs` from `@danielsimonjr/mathts-expression`.** It contains every embedded-docs entry mathjs has (308) plus MathTS extras. `all` and the `expression` namespace stay compat-only, documented in the same migration-guide section, because they are the instance bundle (`compat/src/all-factories.ts`). The test asserts `docs` is exported and `all` is not exported from `functions` or `expression`.
- **#1570 — decision (b), plus aliases that already have an implementation.** Document that mathjs `create*` / `*Dependencies` tree-shaking is a compat feature, and that `factory_<name>` is the typed name for the 63 factories that exist. Also export `createAbs` as an alias of the factory creator next to `factory_abs`, and the same for the other 62 names in the issue’s A2 list, from `@danielsimonjr/mathts-functions`. Do not generate the 261 missing factories and do not generate 371 dependency bundles on the typed packages. The migration guide lists both facts. The export test asserts the 63 aliases exist and that `createAdd` (an A1 name) is absent from `functions` and present on `compat`.
- **#1571 — export the aliases and the classes.** `@danielsimonjr/mathts-core` exports `pi`, `e`, `tau`, `phi`, `i` as the same values as `PI`, `E`, `TAU`, `PHI`, `I`. `@danielsimonjr/mathts-expression` exports the Node classes (`Node`, `ConstantNode`, `SymbolNode`, and the other node classes named in the issue) in addition to `createConstantNode` and the rest. `Parser` is the class `createParserClass` returns at default config; export it from `expression`. `factory` and `import` stay `createFactory` and `importFactory`; the migration guide table says so. `version` is G16, not a second constant here. The ten JS literals (`Infinity`, `NaN`, `true`, `false`, `null`, and the `_` forms) are not exported.

- [ ] **Step 1: Tests** `functions/tests/parity/g12-exports.test.ts` and `expression/tests/parity/g12-exports.test.ts` and `core/tests/parity/g12-exports.test.ts`. They import the packages and mathjs and compare the name lists in the decisions above. `instanceof` test in `functions/tests/parity/g12-errors.test.ts`.

- [ ] **Step 2: Run.** FAIL on the missing names.

- [ ] **Step 3: Export, delete duplicate error classes, write the migration-guide section `Typed packages and the mathjs instance`.**

- [ ] **Step 4: Re-run** and `bunx tsc --noEmit` in `functions`, `expression`, and `core`. A duplicate class that is still imported fails the build; fix the import.

- [ ] **Step 5: Gaps and changelog.** `### Added`: `- **Typed-package surface exports and decisions (#1567, #1568, #1569, #1570, #1571):** Exported canonical error/matrix/node classes, `docs`, lowercase constant aliases (`pi`, `e`, `tau`, `phi`, `i`), and 63 `create*`aliases; documented compat-only decisions for events,`all`/`expression`, and remaining factories in `docs/migration-guide.md`.` Patch changesets: `core`, `functions`, `expression`, `compat`.

**Done:**

- [ ] The decisions are in the migration guide, each with the issue number.
- [ ] `instanceof DimensionError` works for the throw from `add` of two different-length arrays.
- [ ] `docs` has the mathjs keys.
- [ ] The 63 `create*` aliases exist; `createAdd` does not exist on `functions`.

---

## G13 — `expression.transform` and `mathWithTransform`

**Closes:** #1572. Severity P1. Depends on G02 and G01.

**Root cause:** `compat/src/instance-api.ts` lines 157–160 set `transform: {}` and `mathWithTransform` to `{ num, den }` only. The transform functions already exist: `functions/src/factories/evaluate.ts` copies them into the evaluate scope (the key list at lines 107–132) from `factoryScope.mathWithTransform`. They are never copied onto the instance. The live oracle’s 26 keys are `and, apply, bitAnd, bitOr, column, concat, cumsum, diff, filter, forEach, index, map, mapSlices, max, mean, min, nullish, or, print, quantileSeq, range, row, std, subset, sum, variance`. The evaluate-scope list has no `apply`. mathjs has 26, including `apply`.

**Design:** When wiring the instance, set `expression.transform` to those 26 functions (the transform factories). Set `expression.mathWithTransform` to a copy of the instance’s function properties with those 26 replaced by the transform versions. Length 315 is not a constant to hard-code: the test asserts the key set equals the oracle’s key set. `evaluate('max([[1,5],[3,4]], 1)')` already returns `[3, 5]` and must stay.

- [ ] **Step 1: Test** `compat/tests/parity/g13-transform.test.ts`. Compare key sets and `typeof transform.map`. Call `transform.max` on the same matrix the expression uses and compare with mathjs.

- [ ] **Step 2: Run.** FAIL on length 0 vs 26.

- [ ] **Step 3: Fill the objects in `wireMathjsInstanceApi`.** Add `apply` to the transform set if the oracle has it and the factory exists. If `apply` has no factory, port the mathjs transform into `expression/src/transform/apply.transform.ts` following a sibling transform file. That is still the root cause (the transform was never built), not a shim.

- [ ] **Step 4: Re-run.**

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Populate compat `expression.transform`and`mathWithTransform`(#1572):** Wired all 26 mathjs transforms onto`instance.expression.transform`and populated`instance.expression.mathWithTransform` with every instance function.` Patch changesets: `compat`, `expression` if `apply` is new.

**Done:**

- [ ] Key sets match the oracle.
- [ ] The existing expression `max` result still matches.

---

## G14 — Unit names in `toTex`

**Closes:** #1577 (P2) and #1578 (P2).

**Root cause:** `SymbolNode._toTex` (`expression/src/node/SymbolNode.ts` lines 228–232) sets `isUnit` only when `math[name]` is `undefined` and `Unit.isValuelessUnit(name)`. `toSymbol` (`expression/src/utils/latex.ts` lines 353–360) already emits `\mathrm{name}` and `deg` → `^\circ` when `isUnit` is true. The captured output `2~ cm+ b` means `isUnit` is false for `cm`. Either `Unit` is not passed into this SymbolNode factory (`isValuelessUnit` returns false at line 45) or the `math[name] === 'undefined'` guard rejects names that are also functions (`b`, `A`). Both are real. `parse('x + y').toTex()` matches, so non-units are fine.

**Design:** Pass `Unit` into the SymbolNode factory the parser uses. In `_toTex`, a name with `Unit.isValuelessUnit(name)` is a unit even when `math[name]` is a function. `cm`, `m`, `b`, `A`, `B`, `inch`, `g` render as `\mathrm{…}`. `deg` renders as `^\circ`. The leading space rule stays: a symbol that starts with `\` has no extra space (`2~\mathrm{cm}`).

#1578: `OperatorNode` / `ConstantNode` toTex inserts a space after `\wedge`, `\neg`, and `\veebar` before `true` / `false`. Remove that space so the string is exactly `true\wedgefalse`, `\negtrue`, `true\veebarfalse`. This is the decision in S4.

- [ ] **Step 1: Test** `compat/tests/parity/g14-totex.test.ts` with the four #1577 rows and the three #1578 rows, plus `parse(example).toTex()` for the embedded-docs examples once G01 lets them parse. Until G01 is merged, the four direct rows are enough, and the full-surface harness covers the 926 examples.

- [ ] **Step 2: Run.** FAIL on `2~ cm+ b` and on the space in `\wedge false`.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Re-run.** Mutation: put the space back, the #1578 test fails, restore.

- [ ] **Step 5: Gaps, docs, and changelog.** Record the #1578 decision (match mathjs `toTex` boolean-operator spacing) in `docs/api/compat.md`. `### Fixed`: `- **`toTex`unit names and logical operator spacing (#1577, #1578):** Passed`Unit`into`SymbolNode`so units render as`\mathrm{…}`and`deg`as`^\circ`, and matched mathjs 15.3.0 boolean-operator spacing (`true\wedgefalse`, `\negtrue`, `true\veebarfalse`) on purpose.` Patch changesets: `expression`, `compat`.

**Done:**

- [ ] The seven rows match byte for byte.
- [ ] `x + y` is unchanged.

---

## G15 — Fraction `format` and `string`

**Closes:** #1579 (P2) and the `string(fraction)` half of #1573. #1586 is in this group because it is the same ConstantNode printing path. Severity P2.

**Root cause:** `format(fraction(2))` is `"2"` instead of `"2/1"`. The fraction branch of `functions/src/string/format.ts` (and `core` string formatting if `format` delegates) omits the denominator when it is 1. `string(fraction(1,3))` on HEAD is `"0.3333333333333333"` while `fraction(1,3).toString()` is `"0.(3)"`. `string` is not calling `toString`. The issue names `functions/src/factories/index.ts` wiring. `numeric(4, 'Fraction')` formats as `4` instead of `4/1` for the same reason. #1586: `ConstantNode.toString` under Fraction config prints the source form `1 / 3` instead of the value form `1/1 / 3/1`.

**Design:** Integral fractions format as `n/1`, including inside arrays and units (`[1/1, 2/1]`, `5/1 cm`). `string(fraction)` returns the same string as `Fraction.toString` (`0.(3)`). `parse('1/3 + 1/4').toString()` under `number: 'Fraction'` is `1/1 / 3/1 + 1/1 / 4/1`. Evaluate stays `7/12`. Match mathjs; do not keep the shorter form.

- [ ] **Step 1: Test** `compat/tests/parity/g15-fraction-format.test.ts` with the six #1579 rows and the two #1586 rows.

- [ ] **Step 2: Run.** FAIL on `"2"` vs `"2/1"` and on the float string and on the ConstantNode text.

- [ ] **Step 3: Fix `format` and `string` and `ConstantNode.toString`.** `print` uses `format`; it should follow.

- [ ] **Step 4: Re-run** and the Fraction toString tests (#892, #743). Keep their repeating-decimal assertions.

- [ ] **Step 5: Gaps, docs, and changelog.** Record the #1586 decision (match mathjs Fraction-config `ConstantNode.toString`) in `docs/api/compat.md`. `### Changed`: `- **Fraction `format`, `string`, and `ConstantNode.toString`parity (#1579, #1586):** Formatted integral Fractions as`n/1`, routed `string(fraction)`through`Fraction.toString()`, and matched mathjs Fraction-config `ConstantNode.toString()`. BREAKING: `format(fraction(2))`is now`"2/1"`, `string(fraction(1,3))`is`"0.(3)"`, and Fraction-config `parse('1/3 + 1/4').toString()`is`"1/1 / 3/1 + 1/1 / 4/1"`.` Changesets: `functions`, `expression`, `compat`.

**Done:**

- [ ] The issue rows match.
- [ ] `fraction(1,3).toString()` is still `0.(3)`.

---

## G16 — `version` is the emulated mathjs version

**Closes:** #1581. Severity P2.

**Root cause:** `compat/src/instance-symbols.ts` sets `version` from the compat package version. The issue cites line 124. `evaluate('version')` reads that binding. Live mathjs `version` is `"15.3.0"`.

**Design:** A constant `MATHJS_PARITY_VERSION = '15.3.0'` in `compat/src/instance-symbols.ts`. `version` is that string on the instance, the named export, and the expression scope. `compatVersion` is `package.json`’s version. Bump `MATHJS_PARITY_VERSION` only in G00’s successor when the oracle workflow’s version changes; add a test that `MATHJS_PARITY_VERSION` equals the mathjs devDependency. Document `compatVersion` in `docs/api/compat.md` and the README.

- [ ] **Step 1: Test** `compat/tests/parity/g16-version.test.ts`. `version` and `evaluate('version')` equal the oracle. `compatVersion` equals the local package version and is not equal to `version`.

- [ ] **Step 2: Run.** FAIL (`0.7.25` vs `15.3.0`).

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Re-run.**

- [ ] **Step 5: Gaps and changelog.** `### Changed`: `- **Compat `version`reports emulated mathjs version (#1581):** Set`version`to`"15.3.0"`on the compat instance, named export, and expression scope, and added`compatVersion`for the package version. BREAKING: code reading the compat package version from`math.version`must read`compatVersion`.` Changeset: `compat`.

**Done:**

- [ ] Both issue rows match.
- [ ] `compatVersion` is tested.

---

## G17 — Sparse zeros of BigNumber and Unit

**Closes:** #1582. Severity P2.

**Root cause:** `matrix/src/types/SparseMatrix.ts` keeps an entry when `value !== 0` (lines 225, 281, 287, and the later `!== 0` stores). A BigNumber `0` and a Unit `0` are objects, so they are stored. Number zeros are dropped (`density()` 0.5 matches). mathjs uses a numeric zero test that treats BigNumber, Fraction, and Unit zeros as zero. The class is the one `createSparseMatrixClass` builds (`compat/src/native-factory-exports.ts`).

**Design:** One predicate `isStructuralZero(value)` used at every store site that today says `!== 0`. A number uses `=== 0`. A BigNumber uses `.isZero()`. A Fraction uses `.isZero()`. A Unit is zero when its value is a structural zero. Anything else is kept. `unit(sparse([[1,0],[0,2]]))` has density 0.5. BigNumber-config `sparse([[3,0],[5,0]]).density()` is `0.5`. `rotationMatrix(..., 'sparse')` density matches the oracle (`0.555…`). The number-matrix density stays `0.5`.

- [ ] **Step 1: Test** `compat/tests/parity/g17-sparse-zeros.test.ts` with the four issue rows and a Fraction zero.

- [ ] **Step 2: Run.** FAIL on density 1 vs 0.5.

- [ ] **Step 3: Replace the `!== 0` checks** that decide storage. Do not replace index checks such as `rowPointers[0] !== 0`.

- [ ] **Step 4: Re-run** and `matrix/tests` sparse tests.

- [ ] **Step 5: Gaps and changelog.** `### Fixed`: `- **Drop structural zeros for BigNumber/Fraction/Unit in `SparseMatrix`(#1582):** Replaced`!== 0`storage checks with`isStructuralZero` so BigNumber, Fraction, and Unit zeros are omitted like mathjs 15.3.0.` Patch changesets: `matrix`, `compat`.

**Done:**

- [ ] The four rows match.
- [ ] A number sparse matrix is unchanged.

---

## G18 — Keep the more accurate results

**Closes:** #1585. Severity P2. No behavior change.

**Root cause:** Not a defect. `zeta(-3)` is closer to `1/120` than mathjs. Complex `zeta(1+2i)` is finite in compat and NaN in mathjs. BigNumber `zeta(4)` is closer to `π^4/90`. BigNumber `symbolicEqual('x*y','y*x')` is true. BigNumber `range('4:10')` includes 10, like number mode. Live mathjs confirms the worse values (`range` is `[4, 5, 6, 7, 8, 9]`, `symbolicEqual` is false).

**Design:** S4. Add the heading `Intentional divergences` to `docs/api/compat.md` with one paragraph per function, the compat value, and the mathjs value. Test `compat/tests/parity/g18-intentional.test.ts` asserts the compat values and fails if they move to the mathjs values. `intentional.ts` registers these so the full-surface harness does not call them failures.

- [ ] **Step 1: Write the test and the doc section.**

- [ ] **Step 2: Run the test.** It should PASS on HEAD. That is the exception to “the test fails first”: this group pins current behavior. The mutation check is the opposite: temporarily make `zeta(-3)` return the mathjs number in a local edit, confirm the test fails, restore. Do not commit the mutation.

- [ ] **Step 3: Register the cases** in `intentional.ts` and remove them from `known-gaps.json`.

- [ ] **Step 4: Changelog** under `### Fixed` is wrong for a non-change. Use one sentence in the #1590 tracker comment later, and a `### Changed` bullet only if the doc is considered user-facing: “Documented intentional divergences from mathjs for zeta, symbolicEqual, and range (#1585).” Changeset: `compat` (docs in the package README if the package README is the published place; the repo `docs/api/compat.md` is enough if the README links to it).

**Done:**

- [ ] The five values are pinned with the mathjs value in a comment.
- [ ] The doc heading exists.
- [ ] No source function changed.

---

## G19 — `zpk2tf` of a 2-D matrix

**Closes:** #1589. Severity P2.

**Root cause:** `functions/src/signal/zpk2tf.ts` produces `NaN + NaNi` where mathjs produces `Infinity + Infinityi` for `zpk2tf(matrix([[1,2],[3,4]]), matrix([[5,6],[7,8]]))`. The 1-D call `zpk2tf([1,2],[-1,-2],1)` matches. Live oracle format: `[[1, Infinity + Infinityi, Infinity + Infinityi], [1, NaN + NaNi, Infinity + Infinityi]]`. The NaN is a `0 * Infinity` or a log of a non-scalar that the mathjs polynomial product does not do.

**Design:** Match mathjs. Build the polynomial from the roots with the same complex product mathjs uses (read `zpk2tf.js` in the installed mathjs). Do not special-case this one matrix. The 1-D result must stay `[[1, -3, 2], [1, 3, 2]]`. A decision to throw on 2-D input would be a third behavior; do not throw.

- [ ] **Step 1: Test** `compat/tests/parity/g19-zpk2tf.test.ts` with both rows.

- [ ] **Step 2: Run.** The 2-D row fails. The 1-D row passes.

- [ ] **Step 3: Align the product** with the mathjs implementation.

- [ ] **Step 4: Re-run.**

- [ ] **Step 5: Gaps, docs, and changelog.** Record the #1589 decision (match mathjs 2-D `zpk2tf` polynomial product) in `docs/api/compat.md`. `### Fixed`: `- **Align 2-D `zpk2tf`complex polynomial product (#1589):** Matched mathjs 15.3.0 polynomial product behavior for 2-D Matrix arguments in`zpk2tf` while keeping 1-D results unchanged.` Patch changesets: `functions`, `compat`.

**Done:**

- [ ] Both rows match at precision 14.
- [ ] The 1-D assertion is still in the file.

---

## G20 — Meta-API differential tests

**Closes:** #1575. Severity P2. Depends on G12, G13, and G16.

**Root cause:** No test compares `all`, `chain`, `create`, `docs`, `emit`, `expression`, `factory`, `off`, `on`, `once`, `replacer`, `reviver` with mathjs. They exist on the compat instance.

**Design:** `compat/tests/parity/g20-meta.test.ts`.

- `create(all, { number: 'BigNumber' })` then `evaluate('1 + 2')` is a BigNumber on both.
- `factory` of a tiny typed function (the mathjs `factory` contract: name, dependencies, creator) produces a function. Compare `typeof`.
- `chain(2).add(3).done()` is `5` on both.
- `on('config', cb)`, `config({ number: 'Fraction' })`, the callback arguments’ `number` field, then `off`. `once` fires one time. `emit` of a test event reaches the listener. Payloads for `import` include the imported name.
- `Object.keys(docs)` equals the oracle’s key set (G12 exports `docs` from expression; the instance `docs` is the same map).
- `expression.transform` and `mathWithTransform` are G13; this test only checks they are objects.
- `JSON.stringify(value, replacer)` then `JSON.parse(text, reviver)` round-trips a number, Complex, Fraction, BigNumber, Unit, DenseMatrix, and SparseMatrix. Compare `typeOf` and `format` with the same round-trip on mathjs.

- [ ] **Step 1: Write the test.**

- [ ] **Step 2: Run.** Fix any real mismatch in the instance API (`compat/src/instance-api.ts`, replacer/reviver files) at the cause. Do not stub a method to return the mathjs string.

- [ ] **Step 3: Re-run.**

- [ ] **Step 4: Changelog** only if behavior changed. The test itself needs no bullet. If the replacer changed, patch `compat`.

**Done:**

- [ ] One `it` per name in the issue.
- [ ] The round-trip covers the seven types.

---

## G21 — Unpublished surface check

**Closes:** #1573. Severity P1. Last.

**Root cause:** Packages on `main` gained exports (`isNode`, `num`, `den`, and the other `is*` names) and behavior (`string(fraction)`) without a version bump, so the npm tarball at the same version does not match HEAD. G15 fixes `string(fraction)`. The 29 names are already on HEAD; the missing piece is the guard.

**Design:** S8. `tools/test/check-unpublished-surface.mjs` plus `node --test tools/test/check-unpublished-surface.test.mjs` with a fake registry layout (a temp package whose keys differ, and a changeset file that does or does not name it). The test does not hit the network. The script’s network call is guarded by `CHECK_SURFACE_OFFLINE=1` in the unit test. CI runs it without that variable, after `bun run build`.

Do not publish. Do not set `RELEASES_ENABLED`. The changesets added by G00–G20 are what will bump versions when a human merges the version PR later.

- [ ] **Step 1: Write the unit test** with two fixtures: drift without a changeset fails; drift with a changeset passes.

- [ ] **Step 2: Run** `node --test tools/test/check-unpublished-surface.test.mjs`. FAIL until the script exists.

- [ ] **Step 3: Implement the script and the CI step.** Follow `tools/test/ci-step.mjs` patterns so the workflow edit is a real step, not a comment.

- [ ] **Step 4: Run the unit test and `node tools/test/check-unpublished-surface.mjs` with the offline switch.** Then run it online once. If it fails because a package on HEAD has no changeset yet, the changesets from the earlier groups must name that package. Add the missing changeset. Do not silence the script.

- [ ] **Step 5: Confirm `known-gaps.json` has only `1585`, or is empty of functional keys and `intentional.ts` holds #1585.** The full-surface test passes.

- [ ] **Step 6: Changelog.** “CI fails when a package’s built exports differ from the published tarball at the same version and no changeset names the package (#1573).” `compat` / repo tooling; a changeset is optional for `tools/` if tools are not a package. The root changelog bullet is required.

**Done:**

- [ ] The script fails a fixture that drifted.
- [ ] The script does not call `npm publish`.
- [ ] The full-surface allowlist is only the intentional divergences.
- [ ] `bun run typecheck` is still 0 errors for the packages this plan touched, run by the implementer of the last group.

---

## Issue index

| Issue | Group                                        | Severity |
| ----- | -------------------------------------------- | -------- |
| #1549 | G01                                          | P0       |
| #1550 | G02                                          | P0       |
| #1551 | G03                                          | P0       |
| #1552 | G04                                          | P1       |
| #1553 | G05                                          | P1       |
| #1554 | G06                                          | P1       |
| #1555 | G07                                          | P1       |
| #1556 | G01                                          | P1       |
| #1557 | G09                                          | P1       |
| #1558 | G08                                          | P1       |
| #1559 | G08                                          | P1       |
| #1560 | G08                                          | P1       |
| #1561 | G10                                          | P1       |
| #1562 | G01                                          | P1       |
| #1563 | G11                                          | P1       |
| #1564 | G11                                          | P1       |
| #1565 | G11                                          | P1       |
| #1566 | G11                                          | P1       |
| #1567 | G12                                          | P1       |
| #1568 | G12                                          | P1       |
| #1569 | G12                                          | P1       |
| #1570 | G12                                          | P1       |
| #1571 | G12                                          | P2       |
| #1572 | G13                                          | P1       |
| #1573 | G21                                          | P1       |
| #1574 | G00                                          | P1       |
| #1575 | G20                                          | P2       |
| #1576 | G01                                          | P2       |
| #1577 | G14                                          | P2       |
| #1578 | G14                                          | P2       |
| #1579 | G15                                          | P2       |
| #1580 | G01                                          | P2       |
| #1581 | G16                                          | P2       |
| #1582 | G17                                          | P2       |
| #1583 | G02                                          | P2       |
| #1584 | G05                                          | P2       |
| #1585 | G18                                          | P2       |
| #1586 | G15                                          | P2       |
| #1587 | G02                                          | P2       |
| #1588 | G02                                          | P2       |
| #1589 | G19                                          | P2       |
| #1590 | tracker; done when every row above is closed | —        |

Nothing in #1549–#1589 is left without a group. #1568, #1570 (the 261 factories and 371 dependency bundles), and the `all` / `expression` half of #1569 are fixed by the documented decision the issues allow, not by copying the mathjs module graph onto the typed packages. #1585 is fixed by keeping the more accurate behavior and pinning it. Those are decisions, not unfinished fixes.

## Self-review

- Spec coverage: every issue number in the index appears in a group. S1–S8 cover the shared design the tracker asked for (factories, sandbox, oracle, release hygiene, the five decision issues).
- The typed sandbox tests are preserved. Compat hardening is `{ safe: true }` only.
- No step says “add appropriate error handling” without the type and the message.
- `expectSame`, `pair`, `show`, `MATHJS_PARITY_VERSION`, `isStructuralZero`, and `EvaluatePolicy` are defined in S3, S6, G16, and G17 before the groups use them.
