# G13 Challenger Findings — `expression.transform` / `mathWithTransform` (#1572)

**Builder head under review:** `55feaedb78e83765504b37a738ad8c349d1ed919`
(`cursor/g13-transform-3856`, PR #1763)
**Oracle:** live mathjs **15.3.0** (`node_modules/mathjs`)
**Verdict:** **DEFECTS FOUND** (1 real parity defect, 1 minor message divergence)

---

## Summary

The builder did the structural work correctly:

- `expression.transform` has exactly the 26 mathjs keys.
- `mathWithTransform`'s key set is the oracle's minus the documented compat
  denylist, plus the documented `compatBlockResultSet` marker — no extra, none
  missing.
- Every one of the 26 transform keys in `mathWithTransform` is the **transform**
  version (not the 0-based instance function), and `mwt.apply === transform.mapSlices`
  like mathjs's `formerly: 'apply'` resolution.
- All 26 transform functions, called directly, match mathjs on 75+ behavioral
  probes (values and error classes).
- Config liveness (`pi` flips to BigNumber on `config(...)`) and per-instance
  isolation hold; keys are enumerable, own, and `typeof` matches mathjs.

**But** the compat **evaluator** does not resolve `apply` from
`mathWithTransform`: `evaluate('apply(...)')`, `compile(...)`, and `parse(...)`
all run the **zero-based** `apply` alias (`mapSlices`, `formerly: 'apply'`) from
the module math scope instead of the one-based transform the instance advertises.
This makes the very `apply` this PR introduced behave differently through
`evaluate` than through `expression.transform.apply` / `mathWithTransform.apply`,
and differently from mathjs.

---

## Defect 1 — `apply` is zero-based through `evaluate` / `compile` / `parse`

**Severity:** P1 (the exact expression form the G13 plan names as the acceptance
check — `evaluate('apply(...)')` — is wrong).

**Root cause.** `functions/src/factories/evaluate.ts` overlays the expression
transforms into the evaluator scope from `factoryScope.mathWithTransform`, via a
hard-coded key list (lines ~100–135). That list has **25** keys — it omits
`apply` (it predates this PR; `apply` was never in it). The module `mathScope`
separately carries `apply` as the **0-based** `mapSlices` alias
(`functions/src/factories/index.ts:2486`: `export { mapSlices as apply, ... }`),
and `mwt`/`buildEvaluatorScope` in `compat/src/instance-api.ts` deliberately
**skips every wholesale getter** (`if (wholesaleGetters.get(key) === desc.get) continue`),
so the instance's one-based `apply` never reaches the evaluator scope. The name
`apply` then resolves from the module math scope to the 0-based alias.

Because `apply` collides with `Function.prototype.apply`, it also cannot be
re-covered from a user scope (`evaluate('apply()', { apply })` still resolves the
namespace function — the sandbox's `Function.prototype` guard). So the only place
the one-based `apply` is reachable is the direct `transform`/`mathWithTransform`
property, never the expression language.

**Note on policy:** `functions/` is a critical library that G13 must not touch,
so the fix belongs in `compat/` (e.g. do not skip the `apply` wholesale getter
when building the evaluator scope, or inject the one-based `apply` explicitly),
not by editing the `functions` transform key list. This finding is reported, not
fixed, per the challenger contract.

**Reproduction (compat vs live mathjs 15.3.0):**

| expression                                           | mathjs 15.3.0      | compat @ 55feaedb                            |
| ---------------------------------------------------- | ------------------ | -------------------------------------------- |
| `evaluate('apply([[1,2],[3,4]], 2, sum)')`           | `[[3,7]]` (Matrix) | **`IndexError: Index out of range (2 > 1)`** |
| `evaluate('apply([[1,2],[3,4]], 1, sum)')`           | `[[4,6]]`          | **`[3,7]`** (0-based alias)                  |
| `compile('apply([[1,2],[3,4]], 2, sum)').evaluate()` | `[[3,7]]`          | **`IndexError`**                             |
| `parse('apply([[1,2],[3,4]], 2, sum)').evaluate()`   | `[[3,7]]`          | **`Error: Undefined function apply`**        |
| `evaluate('apply([[5,6],[7,8]], 2, max)')`           | `[[6,8]]`          | **`IndexError`**                             |

Meanwhile, on the **same instance**:

- `instance.expression.transform.apply(M, 2, sum)` → `[[3,7]]` ✅
- `instance.expression.mathWithTransform.apply(M, 2, sum)` → `[[3,7]]` ✅
- `instance.evaluate('apply(M, 2, sum)')` → `IndexError` ❌
- sibling `instance.evaluate('mapSlices(M, 2, sum)')` → `[[3,7]]` ✅ (one-based)

So `mapSlices` (one-based) and `apply` (former alias of the same function) disagree
inside `evaluate` — exactly the split this PR was meant to close.

**Failing tests:** `compat/tests/parity/g13-challenger-apply-evaluate.test.ts`
(5 failing, 1 baseline passing). Run:

```bash
cd compat && bunx vitest run tests/parity/g13-challenger-apply-evaluate.test.ts
```

---

## Defect 2 (minor) — `IndexError` `constructor.name` differs (pre-existing, not G13)

**Severity:** P3, informational — **not introduced by this PR.**

On every out-of-range dim probe the error `message` and `e.name` match mathjs, and
both are `instanceof RangeError`, but `e.constructor.name` reads `IndexError`
(compat) vs `RangeError` (mathjs). Confirmed pre-existing: plain `max(M, 0)` /
`column(M, 9)` (untouched by G13) show the identical difference. Not counted
against G13; recorded so a future parity sweep does not chase it here.

---

## Probes run (all clean unless noted)

1. **Policy:** changed files are only
   `expression/src/transform/*`, `compat/src/*`, `compat/tests/*`,
   `docs/api/expression.md`, `.changeset/`, `changelog-fragments/`,
   `tools/test/{bundle-budget,export-lock}.json`. **No** `typed-function`,
   `core`, `matrix`, `functions`, `workpool`, `gpu`, or `parallel` source touched.
2. **Transform key set:** 26/26 exact match; no missing, no extra; all own +
   `typeof function`.
3. **All 26 transforms called directly** on arrays, DenseMatrix, scalars,
   3D arrays, vectors: values and error classes match (except Defect 2 naming).
4. **`apply` deep-dive:** 1-based dim on 2D and 3D; dim 0 / negative /
   out-of-bounds; `BigNumber` dim (`bignumber(1/2/3)`); Array vs DenseMatrix input;
   `apply` vs `mapSlices` identity in `mathWithTransform`. Direct calls all match;
   `evaluate`/`compile`/`parse` do not (Defect 1).
5. **`mathWithTransform` key set vs oracle:** 306 vs 315; difference is exactly
   the documented compat denylist (`compile`, `createUnit`, `derivative`,
   `evaluate`, `help`, `parse`, `parser`, `resolve`, `simplify`, `typed`) plus the
   documented `compatBlockResultSet` — consistent with G01.
6. **Transform-identity in `mathWithTransform`:** all 26 keys are the transform
   versions; `mwt.apply === transform.mapSlices` like mathjs; `mwt.add === add`.
7. **Config liveness:** `pi` → BigNumber on `config({number:'BigNumber'})` and on
   construction; `mathWithTransform.pi` follows; both match mathjs.
8. **Cross-instance isolation:** two `create(all, ...)` instances keep distinct
   `transform`/`mwt` function objects and independent `pi` type; no bleed.
9. **Enumerability / `hasOwnProperty` / `typeof`:** 0 non-enumerable, 0 non-own,
   `typeof` matches mathjs for every key.
10. **Hygiene:** `as unknown as readonly TransformFactory[]` is the only cast (a
    factory-shape widening, no `any`/`as never`/`@ts-ignore`); bundle-budget grew
    `expression/dist/index.js` 376832 → 385024 and `compat create(all)` maxBytes
    2129920 → 2162688 (both within the recorded budget, gate passes); no
    `known-gaps` removals; changelog fragment present, `CHANGELOG.md` untouched.
11. **Suites:** `compat` 2409/2409 pass, `expression` 2326/2326 pass,
    `bun run typecheck` 47/47, `bun run lint` clean, prettier clean,
    bundle-budget gate passes. The builder's own G13 test passes — it does not
    exercise the `evaluate('apply(...)')` path, which is why this slipped through.
