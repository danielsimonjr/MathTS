# Unit Merge Implementation Plan

> **For agentic workers:** implement task-by-task, TDD-strict, atomic commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Collapse the two coexisting `Unit` implementations (core `Unit` in `core/src/types/unit.ts`; mathjs `Unit` factory in `functions/src/type/unit/Unit.ts`) into **one** unified class that both packages use, with no capability loss and the nicer canonical-`toBest` behavior preserved.

**Architecture (revised after cataloging — see Decision Record below):** The mathjs Unit is the feature-complete superset (parser, per-unit prefixes, unit systems, createUnit, toSI/simplify, angle+bit dims, physical constants); the core Unit is a clean subset. Reimplementing mathjs's ~3,000 lines onto the core class is high-risk reinvention with likely capability loss. **Therefore: relocate the mathjs Unit (+ its supporting files) into `core` as the single canonical `Unit`, retire the old core Unit to a thin re-export, and port the core Unit's two genuinely-nicer behaviors (canonical `toBest` prefix selection, e.g. `0.1 mm` not `100 µm`; and the `{mathts,…}` JSON envelope compatibility) onto it.** This keeps every capability, moves the shared type to the package both depend on (`functions → core`), and preserves the good behavior. Both value models already store SI-normalized `.value`, so the storage model is compatible.

**Tech Stack:** TypeScript ESM, `mathTyped` typed-function dispatch, Vitest, Changesets, Turbo.

## Global Constraints

- ESM `.js` import extensions; `strict: true`; eslint zero; kebab-case files.
- The unified class MUST keep dispatching as `'Unit'`: expose `type === 'Unit'`, a `value` property, a `dimensions` property, and `isUnit = true` on the prototype (satisfies `core/src/typed/mathts-typed.ts:222` predicate + the `instanceof` and prototype-flag `isUnit` guards).
- `functions → core` dependency direction is fixed; the unified class lives in `core`. Core must gain any injected deps the mathjs Unit factory needs that it doesn't already have (scalar ops, `format`, `config` surface) — audited in Phase 1.
- Breaking change → single Changeset (`core` minor + `functions` minor + `units` patch). Ship notes: `.notation` (core) and `.units[]` (mathjs) shapes reconciled; JSON envelope; `toBest` heuristic.
- No `--no-verify`; atomic commits; TODO + CHANGELOG per commit.
- Security: don't touch `.github/workflows/*`; workbook stays changeset-ignored.

## Decision Record

- **CONFIRMED by maintainer (2026-07-03): relocate the mathjs Unit into `core` as the single class, and DEEPLY INTEGRATE it** — the relocated Unit must be satisfied by core's OWN primitives (core `Complex`/`BigNumber`/`Fraction`, core `config`, core `format`, and new core scalar arithmetic), not by dragging functions-package utils into core. It becomes a first-class core citizen, absorbing core's existing `unit-definitions.ts`/`unit-prefixes.ts` where they overlap.
- **Base = mathjs Unit (relocated to core), not core Unit.** Rationale: superset of capability; avoids reimplementing parser/systems/createUnit; both already SI-normalize `.value`.

### Phase 1.1 dependency audit (COMPLETE) — the 19 injected `UnitDependencies` → core

| Dep                                                          | Core status                             | Deep-integration action                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Complex`, `BigNumber`, `Fraction`                           | ✅ core exports                         | import from core                                                                                                                            |
| `config`                                                     | ✅ `DEFAULT_CONFIG` (core/src/index)    | wire core config surface                                                                                                                    |
| `format`                                                     | ✅ `core/src/number.ts#format`          | verify option shape; reuse                                                                                                                  |
| `isNumeric`                                                  | ⚠️ number-only (`core/src/utils.ts:10`) | extend to `number\|BigNumber\|Complex\|Fraction`                                                                                            |
| `number`                                                     | ⚠️ needs a converter                    | add/reuse core `number()`                                                                                                                   |
| `addScalar`/`subtractScalar`/`multiplyScalar`/`divideScalar` | ❌ GAP                                  | **NEW `core/src/arithmetic/scalar.ts`** — polymorphic over the 4 numeric types (the numeric classes have `.add`/`.mul` methods to build on) |
| `pow`/`abs`/`fix`/`round`/`equal`                            | ❌ GAP (polymorphic)                    | add to `scalar.ts`                                                                                                                          |
| `?on`                                                        | n/a (optional event hook)               | pass `undefined` (config-change listener unused in core)                                                                                    |

So Phase 1.1's implementation half = **build `core/src/arithmetic/scalar.ts`** (TDD, polymorphic scalar ops) + a polymorphic `isNumeric`. That module is the load-bearing piece of deep integration; everything else in Phase 1.2 is the mechanical move + rewire onto it.

- **`dimensions` = array-9 (mathjs), keep angle+bit.** Superset; core's struct-7 is representable. Core tests that read `.dimensions.temperature` (struct) get a compatibility accessor OR are rewritten (Phase 5).
- **`toBest` = port core's `|log10|`-minimizing scan** over the mathjs prefix tables so results match the nicer core behavior.
- **JSON:** accept BOTH `{mathts,…}` and `{mathjs,…}` on `fromJSON`; emit one canonical envelope (choose `{mathts,…}`, alias kept).

---

## Phase 0 — Characterization safety net (non-breaking, pure test additions)

Capture CURRENT behavior of BOTH Units before any change — especially the thin-covered mathjs features — so the merge can't silently regress them.

### Task 0.1: Characterize mathjs Unit's thin-covered features

**Files:**

- Create: `functions/tests/unit-characterization.test.ts`

- [ ] Pin `unit()` parsing (compound `'5 km/h'`, parentheses, valueless `unit('cm')`), `.toNumeric(u)`, `.simplify()`, `.toSI()`, `.format()`/best-prefix, `splitUnit`, `createUnit`/`deleteUnit`, physical constants (`speedOfLight` etc.), VA/VAR, angle+bit dims — as exact string/number oracles.
- [ ] Run; confirm GREEN (documents present behavior).
- [ ] Commit `test(functions): characterize mathjs Unit features pre-merge`.

### Task 0.2: Characterize core Unit's canonical semantics — ✅ SATISFIED BY EXISTING COVERAGE

The existing `core/tests/types/unit.test.ts` (96 asserts) already pins canonical `.value`, `toBest` results (`0.1 mm`/`1 kg`/`1 MPa`), `add/sub/mul/div/pow`, `to`, `equals`/`dimensionsEqual`, and JSON `{mathts,…}` round-trip. No new file needed — that suite IS the core characterization net and must stay green through Phase 5 (with Phase 5.1 reconciling shape-specific assertions).

---

## Phase 1 — Relocate the mathjs Unit into `core` (dependency audit + move)

### Task 1.1: Audit + provide injected deps in core

**Files:** Read `functions/src/type/unit/Unit.ts` deps (`addScalar…format,config,Complex,BigNumber,Fraction`); Modify core to expose the missing ones.

- [ ] Enumerate the ~19 `UnitDependencies`; mark which core already has (Complex/BigNumber/Fraction) vs must add (scalar ops, `format`, `config` surface).
- [ ] Provide the missing deps in core (import from core's own arithmetic or add thin equivalents). TDD each with a small unit test.
- [ ] Commit.

### Task 1.2: Move Unit.ts + supporting files to core

**Files:** move `functions/src/type/unit/{Unit.ts,unit-types.ts,physicalConstants.ts,function/*}` → `core/src/types/unit/…`; fix import depths + `.js` extensions; absorb into core's `unit-definitions.ts`/`unit-prefixes.ts` where duplicated.

- [ ] Move + rewire imports; `cd core && npx tsc --noEmit` GREEN.
- [ ] Export the unified `createUnitClass`/`Unit` from `core/src/index.ts`.
- [ ] Commit.

---

## Phase 2 — Reconcile behaviors onto the unified class

### Task 2.1: Port core's canonical `toBest` heuristic

- [ ] Failing test: unified `Unit(0.0001,'m').toBest()` → `0.1 mm` (currently `100 µm`).
- [ ] Implement the `|log10(displayed)|`-minimizing scan over mathjs prefix tables.
- [ ] GREEN; commit.

### Task 2.2: JSON envelope + `dimensions` compatibility accessor

- [ ] `fromJSON` accepts `{mathts,…}` and `{mathjs,…}`; add a struct-style `.dimensions.<base>` accessor (or documented rewrite).
- [ ] Tests GREEN; commit.

---

## Phase 3 — Rewire `functions` to the unified core Unit (MAINTAINER CHECKPOINT before starting)

### Task 3.1: `unit()`/`createUnit`/`splitUnit` factory → core Unit

- [ ] `functions/src/factories/index.ts` `createUnitClass` now imported from core; `_Unit`/`unit` unchanged in behavior. Full functions suite GREEN.
- [ ] Commit.

### Task 3.2: `to`/`toBest` (typed layer) → unified Unit; remove operator dual-branching

**Files:** `functions/src/typed/unit.ts`, `functions/src/typed/arithmetic.ts` (remove `UnitLike` dual helpers), `matrix-ops.ts`/`relational.ts`/`cas.ts` type refs.

- [ ] `to(number,string)` constructs the unified Unit; operators drop the core-vs-mathjs branch (one type now).
- [ ] Rewrite `functions/tests/gap-unit-operators.test.ts` dual-flavor block to single type.
- [ ] Full functions suite GREEN; commit.

---

## Phase 4 — Retire the old core Unit

### Task 4.1: Replace `core/src/types/unit.ts` class with a re-export/alias of the unified Unit

- [ ] Keep `DimensionMismatchError`, `UnitParseError`, `isUnit`, `isUnitValue`, `Dimensions`, `dim` exports stable.
- [ ] `units/src/index.ts` re-export still resolves.
- [ ] Commit.

---

## Phase 5 — Test migration + full regression + release

### Task 5.1: Migrate `core/tests/types/unit.test.ts` (96 asserts) to unified semantics

- [ ] Reconcile `.notation` vs `.units[]`, `.dimensions` struct vs array, toBest, JSON. Keep canonical-value + `toBest` oracles.
- [ ] Commit.

### Task 5.2: Migrate `functions/tests/{typed-unit,unit-operators,conversions-parser}.test.ts` + `units/tests/units.test.ts`

- [ ] All GREEN.
- [ ] Commit.

### Task 5.3: Full monorepo regression + changeset + docs

- [ ] `npm run typecheck` (28/28), `npm run test` all packages, `eslint .` per touched package.
- [ ] Changeset (core/functions minor, units patch); CHANGELOG; DEPENDENCY_GRAPH/docs refresh via generators.
- [ ] Commit + push; verify `git ls-remote`.

---

## Self-review checklist

- Dispatch predicate stays satisfied (Global Constraints) — verified Phase 1/3.
- No capability dropped — Phase 0 characterization suite must stay GREEN through Phase 5.
- `toBest` niceness preserved — Phase 2.1.
- Reversal of the base decision surfaced to maintainer before Phase 3 (irreversible-ish after rewire).
