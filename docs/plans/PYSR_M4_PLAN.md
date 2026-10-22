# Plan: M4 — Pareto front, PySR scores, and model selection

**Status:** ready to implement. This file is the contract. Do not widen it into fitting, search, or an AIC/BIC score.
**Package:** `@danielsimonjr/mathts-functions` (`functions/`). **Size:** S. **Depends on:** nothing. No import from `expression/`.
**Source of truth:** [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md) §6 M4 and §2.3. The formulas are PySR at commit `72a9ab9` (`pysr/sr.py`, `calculate_scores` and `idx_model_selection`).
**Bump:** minor (additive). Do not edit `functions/package.json` `"version"`.

`calculate_scores` walks rows in the order given. It does not sort. `idx_model_selection` picks a row index. This module returns the row object instead of an index, and it adds the roadmap's tie rule (lowest complexity, then input order) on top of pandas' first-row `idxmin` / `idxmax`.

## Outcome

Three pure functions and one error class:

- `paretoFront` keeps one finite-loss candidate per complexity, the hall of fame.
- `scoreFront` assigns PySR's log-loss score, or `null` on the linear scale.
- `selectFrontModel` implements `accuracy`, `score`, and `best`.

The name `paretoFront` is required. `paretoDist` already exists and is a distribution, not this.

## Non-goals

- Do not implement the `loss_scale="linear"` docstring sentence about "direct differences". PySR's `refresh` path **skips** `calculate_scores` when the scale is linear (`sr.py`, the `if self.loss_scale == "log"` branch). Scores are `null`. Roadmap §8 question 4 (AIC/BIC) stays unanswered.
- Do not mutate the caller's objects or arrays. Do not add a `score` field onto an input object.
- Do not import `node:` builtins, and do not call `eval` or `new Function`.
- Do not take a `ScalarNode`. The item type `T` is opaque. Tests use strings.

## Files to add or change

| Path                                                                                                                           | Action                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/pareto-front.ts`                                                                                                | **Add.** Implementation. `@packageDocumentation` header citing `calculate_scores` and `idx_model_selection`.                                                                                                                                                                                                    |
| `functions/src/index.ts`                                                                                                       | **Change.** Insert the export block below immediately after the `evaluateScalar` / `ScalarScope` export. If a later `compileScalar` block is already there, insert after that block instead.                                                                                                                    |
| `functions/tests/pareto-front.test.ts`                                                                                         | **Add.** Import `{ describe, expect, it } from 'vitest'` and the functions from `../src/pareto-front.js` and from `../src/index.js`. The file header cites PySR `72a9ab9` and states that every expected score was computed by hand from the formula, then checked with `Object.is` against the literals below. |
| `functions/README.md`                                                                                                          | **Change.** One bullet after the `evaluateScalar` bullet: `` `paretoFront` / `scoreFront` / `selectFrontModel` — hall of fame per complexity, PySR log-loss scores, and `accuracy` / `score` / `best` selection. ``                                                                                             |
| `docs/reference/functions.md`                                                                                                  | **Change.** Add four rows to the curated table under `## Expression Evaluation` (the prose table **above** the generated index, not the generated block): `paretoFront`, `scoreFront`, `selectFrontModel`, `ParetoFrontError`. One-line descriptions from the TSDoc first sentences.                            |
| `tools/generate-functions-reference.mjs`                                                                                       | **Change.** Append those four names to `DOMAIN_SUPPLEMENT['Expression Evaluation']`.                                                                                                                                                                                                                            |
| `.changeset/pareto-front-m4.md`                                                                                                | **Add.** Contents in [Changeset](#changeset).                                                                                                                                                                                                                                                                   |
| `docs/api/functions.md`, `docs/reference/functions.md` generated index, `docs/reference/functions.html`, `docs/Architecture/*` | **Generated** by the commands in [Verification](#verification). Do not hand-edit the `<!-- BEGIN GENERATED EXPORT INDEX -->` block.                                                                                                                                                                             |

## Exports

```ts
export { paretoFront, scoreFront, selectFrontModel, ParetoFrontError } from './pareto-front.js';
export type { FrontCandidate, ScoredCandidate } from './pareto-front.js';
```

### Signatures and TSDoc

```ts
/** One hall-of-fame row. `item` is opaque and is not inspected. */
export interface FrontCandidate<T = unknown> {
  readonly loss: number;
  readonly complexity: number;
  readonly item: T;
}

/**
 * A {@link FrontCandidate} plus a PySR score.
 * `null` means the linear loss scale, where PySR stores no score column.
 * A numeric score may be `+Infinity`, `-Infinity`, or `NaN` (a zero complexity gap).
 */
export interface ScoredCandidate<T = unknown> extends FrontCandidate<T> {
  readonly score: number | null;
}

/**
 * Thrown by {@link scoreFront} and {@link selectFrontModel} for an empty
 * selection, a bad mode, a bad loss scale, or a mixed score column.
 * `paretoFront` does not throw.
 */
export class ParetoFrontError extends Error {
  constructor(message: string);
}

/**
 * Hall of fame: one survivor per complexity, sorted by complexity ascending.
 *
 * A candidate whose `loss` or `complexity` is not finite (`NaN`, `+Infinity`,
 * `-Infinity`) is dropped. That is a documented choice; PySR's frame is assumed
 * to contain finite losses before scoring.
 *
 * Among finite candidates with `===` complexity (`-0` and `0` are the same),
 * keep the strictly smallest loss. If two losses are equal, keep the earlier
 * input. The survivor is then kept only when its loss is **strictly** smaller
 * than the loss of every survivor of lower complexity. The lowest complexity
 * is always kept. A simpler row is never removed because a more complex row
 * is better.
 *
 * Returns a new array of new wrapper objects. `item` is the input reference.
 * The input array and objects are not mutated.
 */
export function paretoFront<T>(candidates: readonly FrontCandidate<T>[]): FrontCandidate<T>[];

/**
 * PySR `calculate_scores`, in array order. Does not sort and does not drop rows.
 *
 * `lossScale` defaults to `'log'`. On `'log'`, the first row scores `0`.
 * Each later row scores `-Math.log(loss / previousLoss) / (complexity - previousComplexity)`
 * when `loss > 0`. When `loss <= 0` (zero **or** negative), the score is `+Infinity`.
 * A zero complexity gap is left to IEEE division (`NaN`, `+Infinity`, or `-Infinity`);
 * there is no special case. On `'linear'`, every score is `null` and a zero loss
 * does **not** become `+Infinity`.
 *
 * Any other `lossScale` throws `ParetoFrontError`
 * (`scoreFront: lossScale must be 'log' or 'linear'`).
 */
export function scoreFront<T>(
  front: readonly FrontCandidate<T>[],
  options?: { lossScale?: 'log' | 'linear' }
): ScoredCandidate<T>[];

/**
 * PySR `idx_model_selection`. `mode` defaults to `'best'`.
 *
 * `'accuracy'` is the minimum loss. `'score'` is the maximum score.
 * `'best'` keeps rows with `loss <= bestLossFactor * min(loss)` (`bestLossFactor`
 * defaults to `1.5`) and then takes the maximum score among them.
 * If every `score` is `null`, `'score'` and `'best'` both fall back to `'accuracy'`
 * (PySR does this when the score column is absent).
 *
 * Ties on the chosen metric: lower complexity wins, then the earlier input index.
 * Score order treats `NaN` as worse than every other score, including `-Infinity`.
 * Two `+Infinity` scores tie and use complexity, then input order.
 *
 * Returns the **same object reference** as the chosen element of `scored`.
 * Throws `ParetoFrontError` on an empty list, a non-finite loss or complexity,
 * a non-finite `bestLossFactor`, a mode other than the three names, a mix of
 * `null` and numeric scores, or a `'best'` filter that keeps no row.
 */
export function selectFrontModel<T>(
  scored: readonly ScoredCandidate<T>[],
  mode?: 'accuracy' | 'score' | 'best',
  options?: { bestLossFactor?: number }
): ScoredCandidate<T>;
```

`ParetoFrontError` sets `this.name = 'ParetoFrontError'`. Messages, exact:

| Situation                         | Message                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| empty `selectFrontModel`          | `selectFrontModel: empty front`                                                                                                   |
| mode not one of the three         | `selectFrontModel: '${mode}' is not a valid model selection strategy.`                                                            |
| `bestLossFactor` not finite       | `selectFrontModel: bestLossFactor must be a finite number`                                                                        |
| any loss or complexity not finite | `selectFrontModel: loss and complexity must be finite`                                                                            |
| some scores `null`, some not      | `selectFrontModel: mixed null and numeric scores`                                                                                 |
| `'best'` filter empty             | `selectFrontModel: no row has loss <= ${threshold}` (`threshold` is the raw number's default `toString()`, not a fixed precision) |
| bad `lossScale`                   | `scoreFront: lossScale must be 'log' or 'linear'`                                                                                 |

Champion scan: start with index 0. Replace index `i` with a later index `j` only when `j` is strictly better. "Better" for accuracy is smaller loss; for score is larger score under the NaN rule above. Equal metric: smaller complexity is better. Equal complexity: the earlier index stays (so `j` does not replace `i`).

## Tests

File header states the formula `score_i = -ln(loss_i / loss_{i-1}) / (c_i - c_{i-1})`, first row `0`, `loss_i <= 0` → `+Infinity`, and names `idx_model_selection` modes `accuracy`, `score`, and `best` with factor `1.5`.

Every `toBe` / `Object.is` below was checked in Node against that formula. Do not recompute expected scores inside the test by calling `scoreFront`. Building a **loss** with `Math.exp` is fine; the literals below already match those products under `Object.is`, so prefer the literals and `toBe`.

### Fixture S — five positive losses, three different winners

Complexities `1, 2, 3, 4, 5`. Losses, in order, the exact float64 values:

| Index | Complexity | Loss literal           | Score (`toBe`) |
| ----- | ---------- | ---------------------- | -------------- |
| 0     | 1          | `1`                    | `0`            |
| 1     | 2          | `0.36787944117144233`  | `1`            |
| 2     | 3          | `0.006737946999085467` | `4`            |
| 3     | 4          | `0.004086771438464067` | `0.5`          |
| 4     | 5          | `0.003182780796509667` | `0.25`         |

These losses are `1`, then successive factors `Math.exp(-1)`, `Math.exp(-4)`, `Math.exp(-0.5)`, `Math.exp(-0.25)`. Each score equals the exponent step divided by the complexity gap, and each of those quotients is exact in float64 (`Object.is`).

Items `'r0'` … `'r4'`. `paretoFront` on this list returns all five, in this order (losses are strictly decreasing). `scoreFront` with omitted options and with `{ lossScale: 'log' }` returns those scores. `item` references are the same strings.

`selectFrontModel` on that scored array:

| Call                                                        | Winner                                            |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `()` and `('best')` and `('best', { bestLossFactor: 1.5 })` | index 3, item `'r3'`, score `0.5`                 |
| `('score')`                                                 | index 2, item `'r2'`, score `4`                   |
| `('accuracy')`                                              | index 4, item `'r4'`, loss `0.003182780796509667` |
| `('best', { bestLossFactor: 3 })`                           | index 2, item `'r2'`, score `4`                   |

Why `'best'` at 1.5 is index 3: `min` loss is the index-4 literal, `1.5 * min` is `0.0047741711947645` (do not assert the threshold). Index 3's loss `0.004086771438464067` is `<=` that threshold; index 2's loss `0.006737946999085467` is not. Index 3's score `0.5` beats index 4's score `0.25`, and index 3's loss is worse than index 4's. That is the "lower accuracy, higher score" case.

At factor 3 the threshold also admits index 2, whose score `4` wins.

The returned winner is the same reference as `scored[i]` (`toBe`).

`{ lossScale: 'linear' }` on the same five rows yields scores `[null, null, null, null, null]`. `selectFrontModel` of that array with `'score'`, with `'best'`, and with `'accuracy'` all return index 4 (`'r4'`).

### Fixture I — zero loss and `+Infinity`

Pass this list straight to `scoreFront` (do not require `paretoFront` first).

| Index | Complexity | Loss                     | Score                         |
| ----- | ---------- | ------------------------ | ----------------------------- |
| 0     | 1          | `1`                      | `0` (`toBe(0)`)               |
| 1     | 2          | `0.1353352832366127`     | `2`                           |
| 2     | 5          | `0.006737946999085468`   | `1`                           |
| 3     | 6          | `0.00012340980408667956` | `4`                           |
| 4     | 8          | `0`                      | `Infinity` (`toBe(Infinity)`) |

Index 1 is `Math.exp(-2)` from `1`. Index 2 is that times `Math.exp(-3)`. Index 3 is that times `Math.exp(-4)`. The gaps are `1`, `3`, `1`, so the scores are `2`, `3/3 = 1`, and `4`. Assert with `toBe`, not `toBeCloseTo`.

`selectFrontModel` `'accuracy'`, `'score'`, and `'best'` all return index 4, because loss `0` is the minimum, the score is `+Infinity`, and `1.5 * 0 = 0` keeps only that row.

A two-row list `{ c: 1, loss: 0 }` then `{ c: 2, loss: 1 }` scores `[0, -Infinity]`. The first row is `0` even though its loss is `0`. The second uses `-Math.log(1 / 0) / 1`.

A two-row list `{ c: 1, loss: -3 }` then `{ c: 2, loss: -1 }` scores `[0, Infinity]`, because `-1 > 0` is false. Same for a second loss of `0`.

### Pareto membership

Input order is **not** complexity order. Items are the strings below. `paretoFront` returns wrappers whose items are exactly `['b', 'j', 'c', 'g']`, complexities `1, 2, 3, 5`, losses `1, 0.7, 0.4, 0.2`.

| Item  | Complexity | Loss        | Why                                                    |
| ----- | ---------- | ----------- | ------------------------------------------------------ |
| `'a'` | 3          | `0.5`       | worse than `'c'` at complexity 3                       |
| `'b'` | 1          | `1`         | kept; lowest complexity                                |
| `'c'` | 3          | `0.4`       | first of the `0.4`s at complexity 3; `0.4 < 0.7`, kept |
| `'d'` | 3          | `0.4`       | tie with `'c'`, later, dropped                         |
| `'e'` | 2          | `1`         | worse than `'j'` at complexity 2                       |
| `'f'` | 4          | `0.4`       | not strictly below complexity 3's `0.4`, dropped       |
| `'g'` | 5          | `0.2`       | `0.2 < 0.4`, kept                                      |
| `'h'` | 0          | `NaN`       | non-finite loss, dropped                               |
| `'i'` | 6          | `Infinity`  | non-finite loss, dropped                               |
| `'j'` | 2          | `0.7`       | best at complexity 2; `0.7 < 1`, kept                  |
| `'k'` | `Infinity` | `1`         | non-finite complexity, dropped                         |
| `'m'` | 7          | `-Infinity` | non-finite loss, dropped                               |

`Object.freeze` the array and every object before the call. The call does not throw, and the input order is still `'a'` first. An empty input returns `[]`. A new array is returned (`not.toBe` the input).

Two more fronts:

- `{ c: 1, loss: 0.5 }` and `{ c: 2, loss: 0.5 }` → only the first (equal loss is not strictly lower).
- `{ c: 1, loss: 0, item: 'z' }`, `{ c: 2, loss: 0.1, item: 'pos' }`, `{ c: 3, loss: -1, item: 'neg' }` → `['z', 'neg']`. `0` is finite, so it stays; `0.1` is not `< 0`; `-1 < 0`.

### Tie-break on a list that is not a front

`selectFrontModel` does not re-filter, so pass these scored rows directly.

| Rows (item, complexity, loss, score)                   | Mode         | Winner                                                               |
| ------------------------------------------------------ | ------------ | -------------------------------------------------------------------- |
| `('later', 5, 0.2, 1)`, `('simpler', 1, 0.2, 9)`       | `'accuracy'` | `'simpler'` (equal loss, lower complexity, even though it is second) |
| `('a', 4, 0.2, 2)`, `('b', 2, 0.3, 2)`                 | `'score'`    | `'b'`                                                                |
| `('a', 2, 0.3, 2)`, `('b', 2, 0.2, 2)`                 | `'score'`    | `'a'` (equal score and complexity, earlier input)                    |
| same two                                               | `'accuracy'` | `'b'` (loss `0.2`)                                                   |
| `('nan', 1, 1, NaN)`, `('zero', 2, 1, 0)`              | `'score'`    | `'zero'`                                                             |
| `('inf1', 3, 1, Infinity)`, `('inf0', 1, 1, Infinity)` | `'score'`    | `'inf0'`                                                             |

### IEEE gaps and errors

`scoreFront` of `{ c: 1, loss: 1 }` then `{ c: 1, loss: 1 }` has second score `NaN` (`Number.isNaN`). `{ c: 1, loss: 1 }` then `{ c: 1, loss: Math.E }` has second score `-Infinity`. `{ c: 1, loss: Math.E }` then `{ c: 1, loss: 1 }` has second score `Infinity`.

| Call                                                                                  | Throws                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `selectFrontModel([])`                                                                | `ParetoFrontError`, `/empty front/`                                        |
| `selectFrontModel(scored, 'median' as 'best')`                                        | `/not a valid model selection strategy/`                                   |
| `selectFrontModel(fixtureS, 'best', { bestLossFactor: NaN })`                         | `/bestLossFactor/`                                                         |
| `selectFrontModel([{ loss: 1, complexity: NaN, score: 0, item: 'x' }])`               | `/must be finite/`                                                         |
| one row score `null`, one row score `1`, mode `'score'`                               | `/mixed null/`                                                             |
| losses `-2` then `-1`, complexities `1` and `2`, scores `0` and `1`, mode `'best'`    | `/no row has loss <=/` because `1.5 * -2 = -3` and neither loss is `<= -3` |
| `scoreFront([], { lossScale: 'linear' })`                                             | does **not** throw; returns `[]`                                           |
| `scoreFront([{ loss: 1, complexity: 1, item: 'a' }], { lossScale: 'nope' as 'log' })` | `/lossScale/`                                                              |

`'accuracy'` on the negative-loss pair (losses `-2`, `-1`) returns the `-2` row and does not throw. The empty-filter throw is only the `'best'` path.

Input objects gain no `score` property (`'score' in inputRow` is false after `scoreFront`).

Index re-export: `paretoFront` imported from `../src/index.js` is the same function as the one from `../src/pareto-front.js`.

## Changeset

File `.changeset/pareto-front-m4.md`:

```md
---
'@danielsimonjr/mathts-functions': minor
---

Add a Pareto hall of fame with PySR log-loss scores and accuracy, score, and best model selection.
```

Do not also bump `expression`. This milestone does not touch it.

## Acceptance criteria

- [ ] `paretoFront`, `scoreFront`, `selectFrontModel`, `ParetoFrontError`, and the two interfaces are exported from `@danielsimonjr/mathts-functions`.
- [ ] Fixture S scores are `0, 1, 4, 0.5, 0.25` under `toBe`. `'best'` selects `'r3'`, `'score'` selects `'r2'`, `'accuracy'` selects `'r4'`, and factor `3` selects `'r2'`.
- [ ] Fixture I's last score is `+Infinity`, its first score is `0`, and a leading loss of `0` scores `0` rather than `+Infinity`.
- [ ] Linear scale stores `null` and selection falls back to accuracy.
- [ ] The membership table returns `b, j, c, g` and drops non-finite losses and complexities. Equal loss does not survive at a higher complexity.
- [ ] Ties break by lowest complexity, then input order. A `NaN` score loses to `0`.
- [ ] Frozen inputs are not mutated. `selectFrontModel` returns the element reference.
- [ ] The error messages match the table.
- [ ] `bunx turbo typecheck --filter=@danielsimonjr/mathts-functions` reports 0 errors.
- [ ] `bunx turbo test --filter=@danielsimonjr/mathts-functions` passes, including this file.
- [ ] `functions` was **built before commit**, so `bun run docs:functions` sees the new exports in `dist`. The generated index lists the four names under Expression Evaluation, not under "Other exports".
- [ ] `bun run check:duplicates:fast` has no new `TRUE_DUPLICATE` (`paretoFront` is not `paretoDist`).
- [ ] `bun run check:browser-safety` passes. No `node:` import.
- [ ] Census regeneration is committed. `bun run check:file-census` passes.
- [ ] The changeset above is present, bump type `minor`.

## Verification

```bash
bunx turbo typecheck --filter=@danielsimonjr/mathts-functions
bunx turbo test --filter=@danielsimonjr/mathts-functions
bunx turbo build --filter=@danielsimonjr/mathts-functions
bun run docs:functions
bun run docs:deps
```

The pre-commit hook runs `docs:functions` and `docs:deps` when `functions/src/**` is staged. A stale `dist` makes the hook write an index that omits the new names; build first. Commit the generated `docs/api/functions.md`, `docs/reference/functions.md`, `docs/reference/functions.html`, and `docs/Architecture/` diffs with the source.

Do not add a benchmark. Selection is a linear scan over a hall of fame.

## Locked decisions

1. **Linear scale means `score: null`**, matching the code path that skips `calculate_scores`. It does not mean `loss_i - loss_{i-1}`.
2. **`loss <= 0` on a non-first log-scale row is `+Infinity`**, including negatives. The roadmap text says "loss = 0"; the Python condition is `curMSE > 0` else `+Infinity`. Follow the Python.
3. **`'best'` with an empty filter throws** `ParetoFrontError`. Pandas `idxmax` on an empty frame also fails; the message is ours.
4. **Non-finite loss and complexity never enter the front.** They are not scored as zero.
5. **Default mode is `'best'`**, which is PySR's `model_selection` default. Default factor is `1.5`. Default loss scale is `'log'`.
6. **No epsilon on complexity.** Grouping uses `===`.
