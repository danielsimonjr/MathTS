# UPT Integration Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the open MathTS-side gaps from the 2026-11-05 UPT audit (N4, U2–U7, U9, U10, D1, D2, and the optional/doc rows N5, U8, D4–D7) without taking on UPT pin bumps or UPT-local policy.

**Architecture:** Unit grammar changes live in `core/src/types/unit/` (`Unit.ts`, `unit-table.ts`, `errors.ts`). Typed-array means live in `functions/src/typed/arithmetic.ts` and stay on the sync pairwise path. Discovery hooks are optional fields on `ScalarDimensionFilter` and `unitToRationalDimension`. Re-export packages are not edited except `statistics` docs and a binding test. One grammar family or one API surface per pull request.

**Tech Stack:** TypeScript ESM, strict, Vitest, Bun, Turborepo, tsdown. No new dependencies. Packages touched: `@danielsimonjr/mathts-core`, `@danielsimonjr/mathts-functions`, `@danielsimonjr/mathts-statistics`.

**Spec:** `docs/superpowers/specs/2026-11-05-upt-integration-gaps-design.md`

## Global Constraints

- Tests import built `dist/` of dependencies. After editing `core`, run `bunx turbo build --filter=@danielsimonjr/mathts-core` before a `functions` vitest. Prefer `bunx turbo test --filter=<pkg>` so `^build` runs.
- No new dependencies. Do not add `autograd`, `tensor`, or a second Fraction package.
- Import extensions are `.js`. Match sibling files.
- `bun run typecheck` stays 0 errors on the packages the task touches. `bun run lint` stays clean (`oxlint --deny-warnings`).
- TDD: failing test, confirm red, minimal implementation, confirm green, changelog, commit.
- `CHANGELOG.md` `[Unreleased]` bullet per task (`### Fixed` for behavior, `### Added` for new spellings and hooks, `### Documented` for docs-only).
- Add a changeset for each published-package behavior change (`bunx changeset`). The packages are pre-1.0, so a breaking change is a **minor** bump and every other change is a patch. Breaking changes in this plan: MT-1 (`mean`/`sum`/`variance`/`std` on `Float64Array` return a number, not a Promise; `.then` on the result fails), MT-4 (`degC/s` and other affine compounds throw by default), MT-8 (bare `ton` throws). The changeset summary names the old and the new behavior.
- Do not set `RELEASES_ENABLED`. Do not tag. Do not `npm publish`. Do not merge the “chore: release packages” PR.
- Do not call `Unit.createUnit` from tests except where an existing test already does. New tests use built-in rows.
- Float32/Float64 copies use `new Float64Array(data)`, never `TypedArray.from`.
- Closed gaps U1, U12, N1, N2, N3 are not tasks.
- UPT-only work (pin bumps, deleting the local splitter, probe opt-in, `applyBitScaleOverride`, admission lists) is not a task.
- Commit footer on every commit:

```
Co-Authored-By: <the model that writes the commit> <noreply@anthropic.com>
```

- The repository is public. A commit message or a PR body holds no session URL and no session trailer.

- One task, one PR, in this order: MT-1, MT-2, MT-3, MT-4, MT-6, MT-7, MT-8, MT-9, D1, D5, D6, D7, D4, MT-10. Merge each PR when its checks pass, before the next task starts. MT-3 starts after MT-2 is on `main`.
- MT-5 (U8, `bit = ln2`) is not implemented: the spec calls it UPT-local policy, and UPT keeps `applyBitScaleOverride`. The skip is recorded in the spec section 4.10, not dropped silently.

---

## File map

| File                                          | Responsibility                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `functions/src/typed/arithmetic.ts`           | Sync `mean` / `sum` / `variance` / `std` for `Array`, `Float32Array`, `Float64Array` |
| `functions/src/typed/statistics.ts`           | Unchanged Promise path (`parallelStatMean` and siblings). Docs point here.           |
| `core/src/numeric/stable.ts`                  | `pairwiseDot` unchanged. Test only.                                                  |
| `core/src/types/unit/Unit.ts`                 | Superscript rewrite, glued segment, affine gate, `to` reading, `cycles`              |
| `core/src/types/unit/unit-table.ts`           | `pc` prefixes, `ton` refusal, `shortton` / `longton`, optional bit scale             |
| `core/src/types/unit/errors.ts`               | `AmbiguousUnitError`                                                                 |
| `functions/src/scalar-dimension.ts`           | `unitToRationalDimension` `mapUnit`                                                  |
| `functions/src/scalar-search.ts`              | `dimensions.equal`                                                                   |
| `functions/src/typed/numeric.ts`              | Optional equilibrated `1e-13` pivot in `linsolve` used by `leastSquares`             |
| `functions/src/numeric/rational-nullspace.ts` | Optional `bigint` cells                                                              |
| `docs/reference/scalar-search.md`             | D1 and D5 sentences                                                                  |
| `statistics/README.md`                        | D7 owner sentence                                                                    |

---

### Task MT-1: N4 — sync typed means

**Files:**

- Modify: `functions/src/typed/arithmetic.ts` (`mean` around 1559, `sum` around 1546, `variance` around 1609, `std` beside variance)
- Test: `functions/tests/upt-n4-typed-mean.test.ts` (create)
- Test: `core/tests/upt-n4-pairwise-dot.test.ts` (create)
- Docs: `docs/reference/functions.md` one paragraph under the `mean` entry, only if that page is hand-written for `mean`. If the page is generated, put the paragraph in `functions/src/typed/arithmetic.ts` JSDoc and let the docs generator pick it up.

**Interfaces:**

- Consumes: `pairwiseSum`, `sumSquaredDeviations` from `@danielsimonjr/mathts-core`. `VarNormalization` already exported beside `variance`.
- Produces: `mean(data): number`, `sum(data): number`, `variance(data, normalization?): number`, `std(data, normalization?): number` for `readonly number[] | Float32Array | Float64Array`. `parallelStatMean(data: Float64Array): Promise<number>` unchanged.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mean, sum, std } from '../src/index.js';

describe('N4 typed reductions are sync numbers', () => {
  it('mean of a length-3 Float32Array is 2', () => {
    const out = mean(Float32Array.of(1, 2, 3));
    expect(out).toBe(2);
    expect(out).not.toBeInstanceOf(Promise);
  });

  it('mean of a length-3 Float64Array is 2 and not a Promise', () => {
    const out = mean(Float64Array.of(1, 2, 3));
    expect(out).toBe(2);
    expect(out).not.toBeInstanceOf(Promise);
  });

  it('mean of a plain array is unchanged', () => {
    expect(mean([1, 2, 3])).toBe(2);
  });

  it('sum of Float32Array matches the plain array', () => {
    expect(sum(Float32Array.of(1, 2, 3))).toBe(sum([1, 2, 3]));
  });

  it('std of Float64Array matches the plain array', () => {
    const a = [1, 2, 3, 4];
    expect(std(Float64Array.of(...a))).toBe(std(a));
  });
});
```

```ts
import { describe, it, expect } from 'vitest';
import { pairwiseDot } from '../src/index.js';

describe('N4 pairwiseDot stays sync on Float32Array', () => {
  it('dot of [1,2,3] with itself is 14', () => {
    const x = Float32Array.of(1, 2, 3);
    const out = pairwiseDot(x, x);
    expect(out).toBe(14);
    expect(out).not.toBeInstanceOf(Promise);
  });
});
```

- [ ] **Step 2: Run — confirm RED**

Run: `bunx vitest run functions/tests/upt-n4-typed-mean.test.ts core/tests/upt-n4-pairwise-dot.test.ts`

Expected: `mean(Float32Array)` throws a typed-function unexpected-type error. `mean(Float64Array)` fails `toBe(2)` because the value is a Promise (or fails `not.toBeInstanceOf(Promise)`). `pairwiseDot` PASSES already. Do not change `pairwiseDot` if it passes.

- [ ] **Step 3: Implement**

In each of `mean`, `sum`, `variance`, and `std`, replace the `Float64Array` signature that `await`s `computePool` with a sync body:

```ts
function asF64(data: ArrayLike<number>): Float64Array | number[] {
  return data instanceof Float64Array || Array.isArray(data)
    ? (data as Float64Array | number[])
    : new Float64Array(data);
}
```

Use the existing `Array` implementation on `asF64(data)` coerced through `pairwiseSum` / `m2OfArray`. `pairwiseSum` and `sumSquaredDeviations` accept `ArrayLike<number>`. Call them directly with the `Float32Array` or `Float64Array`; do not copy a `Float64Array`. Copy a `Float32Array` only if the callee’s type is `number[]` and will not accept `ArrayLike` — if the type is `ArrayLike`, pass the typed array through.

Add an explicit `Float32Array` signature next to `Array` so typed-function dispatch selects it. The function returns `f64`, not `Promise<f64>`.

Delete the `computePool` call from these four exports only. Leave `parallelStatMean` on the pool.

JSDoc on `mean`: “Synchronous pairwise mean. Returns a number for `number[]`, `Float32Array`, and `Float64Array`. The worker-pool mean is `parallelStatMean` and returns a Promise. WASM is not consulted.”

- [ ] **Step 4: Rebuild and confirm GREEN**

Run: `bunx turbo test --filter=@danielsimonjr/mathts-functions --filter=@danielsimonjr/mathts-core -- functions/tests/upt-n4-typed-mean.test.ts core/tests/upt-n4-pairwise-dot.test.ts`

If the filter syntax rejects extra args, run the two vitest files after `bunx turbo build --filter=@danielsimonjr/mathts-functions --filter=@danielsimonjr/mathts-core`.

Expected: PASS. Also run the existing arithmetic and statistics suites in `functions/tests` that mention `mean`.

- [ ] **Step 5: Changelog, changeset, commit**

`### Fixed` — `mean`/`sum`/`variance`/`std` on `Float64Array` return a number; `Float32Array` is accepted; length 3 is not a Promise. `parallelStatMean` remains async.

```bash
git add functions/src/typed/arithmetic.ts functions/tests/upt-n4-typed-mean.test.ts core/tests/upt-n4-pairwise-dot.test.ts CHANGELOG.md .changeset
git commit -m "fix(functions): return numbers from typed means on typed arrays"
```

---

### Task MT-2: U5 + U6 — glued products and superscripts

**Files:**

- Modify: `core/src/types/unit/Unit.ts` (`parseUnit` around 509, `Unit.parse` around 552)
- Test: `core/tests/unit/upt-u5-u6-glued.test.ts` (create)

**Interfaces:**

- Consumes: `_findUnit`, `UnitParseError`.
- Produces: `Unit.parse` accepts `m2K`, `Vs`, `cm^2/Vs`, `NN`, `K²`, `m²`. `parse('mm')` stays millimetre. `parse('mmin')` stays “not found” until MT-3 (two readings with different dimensions). `mol/mL`, `m/ms` and `W/mK` keep their single-unit reading (rule A).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/index.js';

function scaleOf(text: string): number {
  const s = Unit.parse(text).exactScale();
  if (s === null) throw new Error('no scale');
  return s.toNumber();
}

describe('U5 glued products and U6 superscripts', () => {
  it('m2K matches m^2 * K', () => {
    expect(scaleOf('m2K')).toBeCloseTo(scaleOf('m^2*K'), 12);
  });
  it('Vs matches V*s', () => {
    expect(scaleOf('Vs')).toBeCloseTo(scaleOf('V*s'), 12);
  });
  it('cm^2/Vs matches cm^2/(V*s)', () => {
    expect(scaleOf('cm^2/Vs')).toBeCloseTo(scaleOf('cm^2/(V*s)'), 12);
  });
  it('mmin is not a single silent product in MT-2', () => {
    expect(() => Unit.parse('mmin')).toThrow(/not found|ambiguous/i);
  });
  it('NN matches N*N', () => {
    expect(scaleOf('NN')).toBeCloseTo(scaleOf('N*N'), 12);
  });
  it('m⁻¹ matches m^-1', () => {
    expect(scaleOf('m⁻¹')).toBeCloseTo(scaleOf('m^-1'), 12);
  });
  it('K² matches K^2', () => {
    expect(scaleOf('K²')).toBeCloseTo(scaleOf('K^2'), 12);
  });
  it('mm is still the millimetre', () => {
    expect(scaleOf('mm')).toBeCloseTo(scaleOf('m') / 1000, 12);
  });
});
```

`ExactScale` may not have `toNumber`. Use `exactScaleToNumber` from `core/src/types/unit/exact-scale.ts` (already exported from the package barrel — confirm with `core/src/index.ts` before writing the import). If the test file’s import path differs from siblings, copy the import style of `core/tests/unit/*.test.ts`.

- [ ] **Step 2: Run — confirm RED**

Run: `bunx vitest run core/tests/unit/upt-u5-u6-glued.test.ts`

Expected: `UnitParseError` “not found” for `m2K`, and `Unexpected "²"` for `K²`.

- [ ] **Step 3: Implement**

At the start of `Unit.parse`, after `normalizeUnitSpellings`:

```ts
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
// A run of an optional '⁻' and one or more superscript digits becomes one '^' power:
// 'K²' -> 'K^2', 'm⁻¹' -> 'm^-1', 'm⁻¹²' -> 'm^-12'. A '⁻' with no digit after it is left as it is.
function expandSuperscripts(input: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    let j = i;
    let sign = '';
    if (input[j] === '⁻') {
      sign = '-';
      j++;
    }
    let digits = '';
    while (j < input.length && SUPERSCRIPT_DIGITS.includes(input[j])) {
      digits += String(SUPERSCRIPT_DIGITS.indexOf(input[j]));
      j++;
    }
    if (digits !== '') {
      out += '^' + sign + digits;
      i = j;
    } else {
      out += input[i];
      i++;
    }
  }
  return out;
}
```

Apply it to `text` before the cursor loop.

Implement the splitter below. It is the complete algorithm; do not add rules.

**Rule A — a single unit wins.** If `_findUnit(token)` is not null, the token is that one unit. This holds on both sides of a solidus (ISO 80000-1: a prefix and its unit form one symbol). So `mm` is millimetre, `mol/mL` is mole per millilitre, `m/ms` is metre per millisecond, `W/mK` is watt per millikelvin. Today's behavior for every token that `_findUnit` already finds is unchanged.

**Rule C — a refused prefix is not a product.** Before rule B, a token that starts with a prefix symbol (any prefix set) followed by a unit name throws "not found" (`isPrefixedUnitSpelling`). This keeps `mly`, `mpc` and `dBs` refused and also refuses `mAs` and `mmin`.

**Rule B — otherwise, split.** Only when `_findUnit(token)` is null, call `readings(token)`. The hook point is the `if (res === null)` block in `Unit.parse`: after the `REFUSED_UNIT_SPELLINGS` check and before the `not found` throw. A token that is found never reaches the splitter.

```ts
interface Factor {
  readonly name: string; // the spelling that _findUnit accepts, for example 'cm' or 'V'
  readonly power: number; // 1, or the integer of a trailing digit run (m2 -> 2)
}

// Every way to cut `token` into factors. A factor is a substring that _findUnit
// accepts, optionally followed by a run of digits that is its integer power.
function readings(token: string): Factor[][] {
  const out: Factor[][] = [];
  function walk(i: number, acc: Factor[]): void {
    if (i === token.length) {
      if (acc.length >= 2) out.push(acc.slice());
      return;
    }
    for (let j = i + 1; j <= token.length; j++) {
      const name = token.slice(i, j);
      if (_findUnit(name) === null) continue;
      let k = j;
      while (k < token.length && token[k] >= '0' && token[k] <= '9') k++;
      const power = k > j ? Number(token.slice(j, k)) : 1;
      const prev = acc[acc.length - 1];
      if (prev !== undefined && isPrefixRepeat(prev.name, name)) continue;
      acc.push({ name, power });
      walk(k, acc);
      acc.pop();
    }
  }
  walk(0, []);
  return out;
}

// m·m is not a reading, because `mm` is the prefix m on the unit m.
// N·N is a reading, because `NN` is not a prefixed unit.
function isPrefixRepeat(left: string, right: string): boolean {
  if (left !== right) return false;
  const hit = _findUnit(left + right);
  return hit !== null && hit.prefix.name === left && hit.unit.name === right;
}
```

Then:

1. Zero readings: throw today's `UnitParseError` `Unit "<token>" not found.` (keep the refused-spelling check before it).
2. Group the readings by their dimension vector. For each reading, build `dims` (length `BASE_DIMENSIONS.length`, start at 0): for each factor add `_findUnit(f.name)!.unit.dimensions[i] * f.power` (a missing entry counts as 0). The group key is `JSON.stringify(dims)`. Inside one group keep one reading: the fewest factors, then the lexicographically first spelling `factors.map(f => f.power === 1 ? f.name : f.name + '^' + f.power).join('*')`.
3. One group left: for each factor of the kept reading, in order, `const r = _findUnit(f.name)!`, push `{ unit: r.unit, prefix: r.prefix, power: f.power * power }` into `unit.units`, and add `(r.unit.dimensions?.[i] || 0) * f.power * power` to `unit.dimensions[i]` for each `i`. `power` is the value the parser already computed for the token (the solidus, the parentheses and any `^p` after the token). Then skip the normal single-unit push for this token. So `m2K/s` is `(m^2*K)/s` and `cm^2/Vs` is `cm^2/(V*s)`.
4. Two or more groups: MT-2 throws `UnitParseError` `Unit "<token>" not found.`; MT-3 replaces this with `AmbiguousUnitError`.

Superscripts: run `expandSuperscripts` on the text before the cursor loop, after `normalizeUnitSpellings`. The parser then reads `K^2` for `K²` and `m^-1` for `m⁻¹`.

Record rules A and B, and the tie-break of step 2, in the JSDoc of `Unit.parse`.

- [ ] **Step 4: GREEN**

Run: `bunx vitest run core/tests/unit/upt-u5-u6-glued.test.ts` and the existing unit parse suite.

Expected: PASS. `mm`, `mol`, `Hz`, `min` unchanged.

- [ ] **Step 5: Commit**

`### Added` — glued unit products and Unicode superscripts.

```bash
git commit -m "feat(core): parse glued unit products and superscripts"
```

---

### Task MT-3: U7 — ambiguous dimension readings

Depends on the MT-2 splitter. Start it after MT-2 is on `main`. Rule C refuses `mAs` and `mmin` before the splitter, so the test examples below change: before writing the test, enumerate tokens that still reach two dimension groups (for example with a script over the unit table) and use those; if none exist, the task reduces to the error class and its export, tested through a unit-level call of the grouping step.

**Files:**

- Modify: `core/src/types/unit/errors.ts`
- Modify: `core/src/types/unit/Unit.ts` (the segmenter from MT-2)
- Modify: `core/src/index.ts` export list if errors are re-exported there
- Test: `core/tests/unit/upt-u7-ambiguous.test.ts` (create)

**Interfaces:**

- Produces:

```ts
export class AmbiguousUnitError extends UnitParseError {
  readonly readings: readonly string[];
  constructor(token: string, readings: readonly string[]);
}
```

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { AmbiguousUnitError, Unit } from '../../src/index.js';

describe('U7 distinct dimension readings', () => {
  it('mAs names both readings', () => {
    try {
      Unit.parse('mAs');
      throw new Error('mAs parsed');
    } catch (err) {
      expect(err).toBeInstanceOf(AmbiguousUnitError);
      expect([...(err as AmbiguousUnitError).readings].sort()).toEqual(['m*A*s', 'mA*s']);
    }
  });

  it('mol/mL is mole per millilitre (a single unit wins)', () => {
    expect(Unit.parse('mol/mL').equalBase(Unit.parse('mol/L'))).toBe(true);
  });

  it('mmin names metre-minute and millimetre-inch', () => {
    expect(() => Unit.parse('mmin')).toThrow(AmbiguousUnitError);
  });

  it('mm still parses', () => {
    expect(Unit.parse('mm').equalBase(Unit.parse('m'))).toBe(true);
  });
});
```

Confirm `equalBase` exists on the instance (`Unit.ts` uses it). If the public name differs, compare `dimensions` arrays.

- [ ] **Step 2: RED** — `mAs` and `mmin` throw `UnitParseError`, not `AmbiguousUnitError`.

- [ ] **Step 3: Implement**

In step 4 of the MT-2 splitter, throw `new AmbiguousUnitError(token, spellings)` instead of the "not found" error. `spellings` is the kept spelling of each group (step 2), sorted. The message is `Unit "<token>" is ambiguous: <spellings joined by " or ">. Write the product with "*" or use a single unit.`

Export the class from the same barrel as `UnitParseError`.

- [ ] **Step 4: GREEN** plus the MT-2 test file still passing.

- [ ] **Step 5: Commit** `feat(core): refuse dimensionally ambiguous unit splits`

---

### Task MT-4: U3 + U4 — affine compounds and difference `to`

**Files:**

- Modify: `core/src/types/unit/Unit.ts` (`Unit.parse` options, `Unit.prototype.to` at 1471)
- Modify: `core/src/types/unit/unit-types.ts` if `ParseOptions` and the `to` signature live there
- Test: `core/tests/unit/upt-u3-u4-affine.test.ts` (create)

**Interfaces:**

- Produces: `ParseOptions.affine?: 'absolute' | 'difference'`. `to(target, { reading?: 'absolute' | 'difference' })`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/index.js';

describe('U3 affine compounds and U4 difference conversion', () => {
  it('refuses degC/s', () => {
    expect(() => Unit.parse('degC/s')).toThrow(/affine/i);
  });
  it('refuses 1*degC as a product', () => {
    expect(() => Unit.parse('1*degC')).toThrow(/affine/i);
  });
  it('25 degC is still 298.15 K', () => {
    const kelvin = Unit.parse('25 degC').to('K');
    expect(kelvin.value).toBeCloseTo(298.15, 10);
  });
  it('difference 25 degC to K is 25', () => {
    const kelvin = Unit.parse('25 degC').to('K', { reading: 'difference' });
    expect(kelvin.value).toBeCloseTo(25, 10);
  });
  it('absolute 1 degC to K is still 274.15', () => {
    expect(Unit.parse('1 degC').to('K').value).toBeCloseTo(274.15, 10);
  });
});
```

- [ ] **Step 2: RED** — `degC/s` parses; `to` throws on the second argument or ignores it.

- [ ] **Step 3: Implement**

A parsed unit list is affine-compound when any factor has a nonzero built-in offset and the list is not exactly one factor at power `+1`. The leading-value path (`25 degC`) is that single factor. The `*` path pushes a product and is a compound.

Default: throw `UnitParseError` with the word `affine` in the message. `affine: 'absolute'` parses and keeps offsets. `affine: 'difference'` parses and sets a flag the converter reads so offsets are skipped.

`to` second argument: when `reading === 'difference'`, convert using scales only. Use `unitRowExactOffset` / the exact-scale helpers already in this file so degF’s `5/9` is the scale and `459.67` is the skipped offset. Default `reading` is `'absolute'`.

- [ ] **Step 4: GREEN** and the existing temperature conversion tests.

- [ ] **Step 5: Commit** `feat(core): refuse affine compounds and add difference to()`

---

### Task MT-5: U8 — optional `bit = ln2` (not implemented; kept for reference)

**Files:**

- Modify: `core/src/types/unit/Unit.ts` parse options
- Test: `core/tests/unit/upt-u8-bit.test.ts` (create)

**Interfaces:**

- Produces: `Unit.parse(text, { bit?: 'storage' | 'ln2' })`. Omitted means storage, scale 1, base BIT. `'ln2'` applies only to that parse: dimensionless, exact scale ln 2. The built-in row is not mutated. `Unit.createUnit` is not called.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Unit, exactScaleToNumber } from '../../src/index.js';

describe('U8 optional bit scale', () => {
  it('default bit scale is 1', () => {
    expect(exactScaleToNumber(Unit.exactScale('bit')!)).toBe(1);
  });
  it('parse option ln2 uses Math.LN2 and a zero dimension vector', () => {
    const u = Unit.parse('bit', { bit: 'ln2' });
    expect(exactScaleToNumber(u.exactScale()!)).toBeCloseTo(Math.LN2, 12);
    expect(u.dimensions.every((d: number) => d === 0)).toBe(true);
  });
});
```

Adjust the exact-scale import to the barrel’s real name (`exactScaleToNumber`).

- [ ] **Step 2: RED** — second parse throws on unknown option or returns scale 1.

- [ ] **Step 3: Implement** inside `Unit.parse` only, after the row is found, when the matched unit base is `BIT` and `options.bit === 'ln2'`. Replace that factor’s scale with ln 2 and its dimension contribution with zeros. Do not write the table.

- [ ] **Step 4: GREEN.** Default `Unit.exactScale('bit')` test still 1.

- [ ] **Step 5: Commit** `feat(core): optional ln2 scale for one bit parse`. If the owner skips this task, do not commit a stub.

---

### Task MT-6: U9 — `cycles` on `to`

**Files:**

- Modify: `core/src/types/unit/Unit.ts` (`to` around 1495, where `bridge` is known)
- Modify: `core/src/types/unit/unit-types.ts` instance field
- Test: `core/tests/unit/upt-u9-cycles.test.ts` (create)

**Interfaces:**

- Produces: returned unit `.cycles: number`. `Unit.exactScale('Hz')` unchanged (numeric 1). `to('rad/s')` value unchanged (`2 * Math.PI`).

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Unit, exactScaleToNumber } from '../../src/index.js';

describe('U9 cycles', () => {
  it('exactScale Hz is 1', () => {
    expect(exactScaleToNumber(Unit.exactScale('Hz')!)).toBe(1);
  });
  it('Hz to rad/s is 2π and cycles 1', () => {
    const u = Unit.parse('1 Hz').to('rad/s');
    expect(u.value).toBeCloseTo(2 * Math.PI, 12);
    expect(u.cycles).toBe(1);
  });
  it('Hz to 1/s is 1 and cycles 0', () => {
    const u = Unit.parse('1 Hz').to('1/s');
    expect(u.value).toBeCloseTo(1, 12);
    expect(u.cycles).toBe(0);
  });
});
```

- [ ] **Step 2: RED** — `cycles` is `undefined`.

- [ ] **Step 3: Implement** Set `other.cycles = bridge` after the bridge check (`bridge === 0` → `0`). Initialize `cycles` to `0` on `new Unit()`. Do not change `cyclesToRadians` or `exactScale`.

- [ ] **Step 4: GREEN.**

- [ ] **Step 5: Commit** `feat(core): report cycle count on unit conversion`

---

### Task MT-7: U10 — full SI prefixes on `pc`

**Files:**

- Modify: `core/src/types/unit/unit-table.ts` line `pc:` (`prefixes: 'SHORT_UP_ONLY'` → `'SHORT'`)
- Test: `core/tests/unit/upt-u10-parsec.test.ts` (create)

**Interfaces:**

- Consumes: existing `SHORT` prefix set. Does not add an export. `UNIT_PREFIX_SETS` stays as it is. `ly` stays `SHORT_UP_ONLY`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Unit, exactScaleToNumber } from '../../src/index.js';

describe('U10 parsec prefixes', () => {
  it('mpc is a milliparsec', () => {
    const mpc = exactScaleToNumber(Unit.parse('mpc').exactScale()!);
    const pc = exactScaleToNumber(Unit.parse('pc').exactScale()!);
    expect(mpc).toBeCloseTo(pc / 1000, 6);
  });
  it('kpc still parses', () => {
    expect(Unit.parse('kpc').equalBase(Unit.parse('pc'))).toBe(true);
  });
});
```

- [ ] **Step 2: RED** — `Unit "mpc" not found.`

- [ ] **Step 3: Change the `pc` row’s `prefixes` to `'SHORT'`.

- [ ] **Step 4: GREEN.** `ly` test if one exists must still reject `mly`.

- [ ] **Step 5: Commit** `feat(core): allow sub-kilo SI prefixes on pc`

---

### Task MT-8: U2 — refuse bare `ton`

**Files:**

- Modify: `core/src/types/unit/unit-table.ts` (`ton` row, aliases `tons`, new `shortton`, `longton`)
- Modify: `core/src/types/unit/errors.ts` if MT-3’s class is on `main`; otherwise throw `UnitParseError` with `ambiguous` in the message and the three spellings. Prefer `AmbiguousUnitError` when MT-3 has landed.
- Test: `core/tests/unit/upt-u2-ton.test.ts` (create)

**Interfaces:**

- Produces: `shortton` = `2000*pound`, `longton` = `2240*pound`, `t` and `tonne` unchanged at 1000 kg. `ton` / `tons` throw.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Unit, exactScaleToNumber } from '../../src/index.js';

describe('U2 ton', () => {
  it('refuses bare ton', () => {
    expect(() => Unit.parse('ton')).toThrow(/shortton|long ton|tonne/i);
  });
  it('t is still 1000 kg', () => {
    expect(exactScaleToNumber(Unit.parse('t').exactScale()!)).toBe(1000);
  });
  it('shortton is 2000 lb', () => {
    const lb = exactScaleToNumber(Unit.parse('pound').exactScale()!);
    expect(exactScaleToNumber(Unit.parse('shortton').exactScale()!)).toBeCloseTo(2000 * lb, 6);
  });
});
```

- [ ] **Step 2: RED** — `ton` parses and equals 2000 lb.

- [ ] **Step 3: Add `shortton` and `longton` rows. Remove `ton` from the success table so a parse cannot return 2000 lb. When `AmbiguousUnitError` is already on `main` (MT-3), `Unit.parse('ton')` and `Unit.parse('tons')` throw that class with readings `shortton`, `longton`, and `t` (the message also names `tonne`). If this PR lands before MT-3, throw `UnitParseError` from `REFUSED_UNIT_SPELLINGS` with reason `ambiguous: US short ton (shortton, 2000 lb), UK long ton (longton, 2240 lb), or metric tonne (t, tonne)`, and switch the throw to `AmbiguousUnitError` in the MT-3 PR. Do not keep both a refused spelling and a successful `ton` row.

- [ ] **Step 4: GREEN.**

- [ ] **Step 5: Commit** `fix(core): refuse ambiguous ton spelling`

---

### Task MT-9: D2 — `mapUnit` and `equal`

**Files:**

- Modify: `functions/src/scalar-dimension.ts` (`unitToRationalDimension` at the `vector[8]` check)
- Modify: `functions/src/scalar-search.ts` (`ScalarDimensionFilter` at line 94, and the site that compares root dimension to `target`)
- Test: `functions/tests/upt-d2-dimension-hook.test.ts` (create)

**Interfaces:**

- Produces:

```ts
unitToRationalDimension(
  unitName: string,
  options?: { mapUnit?: (unitName: string) => RationalDimension }
): RationalDimension

interface ScalarDimensionFilter {
  // existing fields unchanged
  readonly equal?: (left: RationalDimension, right: RationalDimension) => boolean;
}
```

Default `unitToRationalDimension('bit')` still throws. Default dimension compare stays `Fraction.equals` per component. The hook path does not read index 8.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { unitToRationalDimension, type RationalDimension } from '../src/index.js';

const zeros = (): RationalDimension =>
  [0, 0, 0, 0, 0, 0, 0].map(() => new Fraction(0n, 1n)) as unknown as RationalDimension;

describe('D2 caller dimension map', () => {
  it('bit still throws with no hook', () => {
    expect(() => unitToRationalDimension('bit')).toThrow(/information|bit/i);
  });
  it('mapUnit supplies the 7-vector and does not throw', () => {
    const dim = zeros();
    const out = unitToRationalDimension('bit', { mapUnit: () => dim });
    expect(out).toBe(dim);
  });
});
```

Rebuild `core` first if `Fraction` types fail. The cast is only at the fixture; if `RationalDimension` rejects the cast, construct seven `new Fraction(0n, 1n)` in a tuple type the helper already exports.

- [ ] **Step 2: RED** — the second call throws the axis-8 error or “too many arguments”.

- [ ] **Step 3: Implement** If `options.mapUnit` is set, return its value after checking `Array.isArray` length 7 and `isFraction` on each cell. Do not read `vector[8]` on that branch. In the search, replace the target compare with `options.equal(root, target)` when `equal` is set; if it throws, score `Infinity` the way an inconsistent solve does.

- [ ] **Step 4: GREEN.** Existing dimension-filter tests and the seed-7 pin stay green (`functions/tests/scalar-search.test.ts`).

- [ ] **Step 5: Commit** `feat(functions): caller dimension equality and mapUnit`

---

### Task MT-10: N5 — softer least-squares pivot (skippable)

**Files:**

- Modify: `functions/src/typed/numeric.ts` `leastSquares` (338) and the pivot test in `linsolve` (215) **only via a parameter**. Do not change `linsolve`’s default `1e-15` for other callers.

**Interfaces:**

- Produces: `leastSquares` equilibrates columns of `A`, then calls an internal solve whose pivot limit is `1e-13` relative to the equilibrated scale. Still throws `Error('linsolve: singular matrix')`. No `null` return.

- [ ] **Step 1: Failing test** `functions/tests/upt-n5-least-squares.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { leastSquares } from '../src/index.js';

describe('N5 leastSquares pivot', () => {
  it('solves a well-conditioned system', () => {
    expect(
      leastSquares(
        [
          [1, 0],
          [0, 1],
          [1, 1],
        ],
        [1, 1, 2]
      )
    ).toEqual([1, 1]);
  });
  it('throws when a column is a 1e-14 copy of another', () => {
    const eps = 1e-14;
    expect(() =>
      leastSquares(
        [
          [1, 1 + eps],
          [1, 1],
          [1, 1],
        ],
        [1, 1, 1]
      )
    ).toThrow(/singular/);
  });
});
```

Tune `eps` only if a column scaled by `1e-14` is still above the relative cutoff after equilibration; the assertion is “near `1e-13`”, not “the audit’s exact 3×2 matrix”. Record the matrix in the test name.

- [ ] **Step 2: RED or already-green.** If the `1e-14` case already throws, tighten the fixture toward `1e-12` until it does **not** throw, then implement. If a well-conditioned system throws after the change, revert the threshold and leave N5 open. Do not ship a regression.

- [ ] **Step 3: Equilibrate.** Divide each column of `A` by its max-abs (skip a zero column — that is already singular). Build `AᵀA` from the scaled columns. Pass `relativeTol: 1e-13` into a new optional argument of the local solver used only by `leastSquares`. Compare `maxVal < relativeTol * scale` where `scale` is the max-abs of the remaining pivot column. Public `linsolve(A, b)` keeps `1e-15` absolute.

- [ ] **Step 4: GREEN** on this file and any existing `leastSquares` / `linsolve` tests.

- [ ] **Step 5: Commit** `fix(functions): equilibrate leastSquares pivots near 1e-13` or skip with no commit.

---

### Task D1: admit hook is the UPT validate contract

Behavior is already on `main` (`grammar.admit` in `functions/src/scalar-search.ts`, SR-1). This task locks it. Do not add a printer. Do not add a string entry point.

**Files:**

- Modify: `docs/reference/scalar-search.md` (the existing `admit` paragraph)
- Test: `functions/tests/upt-d1-admit-contract.test.ts` (create)

**Interfaces:**

- Consumes: `searchScalars`, `createScalarBuilder` or the builder tests already use, `scalarToTex`.

- [ ] **Step 1: Characterization test** (expected PASS on current `main`; if RED, restore admit before any other edit). The same throw is already pinned at `functions/tests/scalar-search.test.ts` around the case “throws the existing RangeError when admit rejects every tree”. This file is the UPT-facing lock that also checks `scalarToTex`.

```ts
import { describe, it, expect } from 'vitest';
import {
  createScalarBuilder,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import { compileScalar, scalarToTex, searchScalars } from '../src/index.js';

const b = createScalarBuilder();
const X = b.symbol('x');

function observedOf(node: ScalarNode, x: Float64Array): Float64Array {
  return compileScalar(node, { variables: ['x'] }).evaluate([x]).values;
}

describe('D1 search contract for a later UPT caller', () => {
  it('scalarToTex is a function and does not accept a formula string', () => {
    expect(typeof scalarToTex).toBe('function');
    expect(typeof scalarToTex(X)).toBe('string');
  });

  it('admit that rejects every node throws before a hall entry', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+', '*', '^'],
      unary: [],
      literals: [1],
      maxSize: 7,
      admit: () => false,
    };
    const xs = new Float64Array([0, 1]);
    const planted = b.op('+', [b.op('*', [X, X]), X]);
    const gen = searchScalars(
      {
        variables: ['x'],
        columns: [xs],
        observed: observedOf(planted, xs),
      },
      {
        grammar,
        rng: createSeededRng(7),
        seeds: [X],
        maxEvaluations: 10,
      }
    );
    await expect(gen.next()).rejects.toThrow('searchScalars: the grammar admits no tree');
  });
});
```

- [ ] **Step 2: Run.** Expected PASS. A failure means admit regressed; fix the call site in `scalar-search.ts` that skips seeds, using the SR-1 rule: rejected seed skipped, rejected offspring counts toward 10 attempts.

- [ ] **Step 3: Docs paragraph.** State: formula strings are rejected; `admit` is the predicate a caller such as UPT `validate` supplies; `scalarToTex` is the printable form; omitting `dimensions` does not require a newer symbol than `searchScalars` itself. Published `@danielsimonjr/mathts-functions@0.72.0` already has SR-1 (`admit` on seeds and offspring); `functions/CHANGELOG.md` `## 0.72.0` is the package record. The root `[Unreleased]` list still repeats SR-1; it does not mean the version was not bumped.

- [ ] **Step 4: GREEN.**

- [ ] **Step 5: Commit** `docs(functions): lock searchScalars admit as the validate hook`

---

### Task D4: optional bigint cells on `rationalNullspace` (skippable)

**Files:**

- Modify: `functions/src/numeric/rational-nullspace.ts` (cell type at the converter)
- Test: `functions/tests/upt-d4-nullspace-bigint.test.ts` (create)

**Interfaces:**

- Produces: cell type `number | Fraction | bigint`. `bigint` becomes `new Fraction(cell, 1n)`. A non-integer `number` still uses `Fraction.fromNumber`. A mix of `bigint` and a non-integer `number` throws `TypeError`. Integer `number[][]` behavior unchanged.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { rationalNullspace } from '../src/index.js';

const bigintA = [
  [1n, 0n, 0n, 0n, 0n, 0n, 0n],
  [0n, 1n, 0n, 0n, 0n, 0n, 0n],
] as const;
const numberA = [
  [1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
];

describe('D4 rationalNullspace bigint cells', () => {
  it('accepts a 7-column bigint matrix', () => {
    const { basis } = rationalNullspace(bigintA as unknown as bigint[][]);
    expect(basis.length).toBeGreaterThanOrEqual(5);
    for (const vec of basis) {
      for (const cell of vec) expect(cell.denominator).toBe(1n);
    }
  });
  it('matches the integer number[][] basis strings', () => {
    const b = rationalNullspace(bigintA as unknown as bigint[][]).basis.map((row) =>
      row.map((c) => c.toString()).join(',')
    );
    const n = rationalNullspace(numberA).basis.map((row) => row.map((c) => c.toString()).join(','));
    expect(b).toEqual(n);
  });
});
```

If `Fraction` exposes `den` not `d`, use the sibling test’s property name (`functions/tests` files that call `rationalNullspace`).

- [ ] **Step 2: RED** — `bigint` cell throws inside `fromNumber` or the fraction check.

- [ ] **Step 3: Branch on `typeof cell === 'bigint'` before `fromNumber`.

- [ ] **Step 4: GREEN** plus existing `rational-nullspace` tests.

- [ ] **Step 5: Commit** `feat(functions): accept bigint cells in rationalNullspace`

---

### Task D5: document one ranking/refit loss

**Files:**

- Modify: `docs/reference/scalar-search.md` next to the `loss` paragraph
- No behavior change. SR-3 is already in `functions/src/scalar-search.ts`.

- [ ] **Step 1: Add this paragraph, verbatim in substance:**

`loss` (`'l2' | 'l1' | 'huber'`, default `'l2'`) is the objective both the hall and `fitScalarParameters` use. Under `invalidRows: 'penalize'` the ranker adds `INVALID_ROW_PENALTY` times each invalid positive-weight row on top of that loss; the fitter’s reported loss does not include those rows. That penalty is not a second loss name. Callers who need a holdout (UPT discovery) keep it outside this function.

- [ ] **Step 2: No test run required beyond `bun run format` on the file if prettier is in the hook.

- [ ] **Step 3: Commit** `docs(functions): state that search loss is one objective`

`### Documented` changelog bullet.

---

### Task D6: no new linalg primitive

**Files:**

- Test: `functions/tests/upt-d6-search-linalg-exports.test.ts` (create)

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';

describe('D6 search linalg exports', () => {
  it('has the primitives search already uses', () => {
    for (const name of [
      'inv',
      'det',
      'ols',
      'matrixRank',
      'rationalNullspace',
      'svd',
      'eigs',
      'leastSquares',
    ] as const) {
      expect(typeof F[name]).toBe('function');
    }
  });
});
```

The test checks only that the primitives exist. It does not lock the absence of any name.

- [ ] **Step 2: Expected PASS.** If a name is missing, stop. Do not add a decomposition in this task. File the gap against the spec’s D6 section and leave the primitive unimplemented.

- [ ] **Step 3: Commit** the test only: `test(functions): lock linalg exports used by scalar search`

---

### Task D7: one owner per distribution

**Files:**

- Modify: `statistics/README.md` (one sentence under the opening paragraph)
- Test: `tests/integration/upt-d7-statistics-owner.test.ts` (create) or `statistics/tests/` if that package’s runner can import both packages. `statistics` depends on `functions`; a test inside `statistics` is the smaller build.

**Sentence:** “Every name this package exports is implemented in `@danielsimonjr/mathts-functions`. This package does not define a second copy of a distribution.”

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import {
  chiSquaredCDF as fromFunctions,
  normalCDF as normalFunctions,
} from '@danielsimonjr/mathts-functions';
import {
  chiSquaredCDF as fromStatistics,
  normalCDF as normalStatistics,
} from '@danielsimonjr/mathts-statistics';

describe('D7 one distribution owner', () => {
  it('re-exports the functions implementations', () => {
    expect(fromStatistics).toBe(fromFunctions);
    expect(normalStatistics).toBe(normalFunctions);
  });
});
```

Place the file where those bare package imports already resolve (see `statistics/tests` or `tests/integration`). Rebuild `functions` before `statistics` tests.

- [ ] **Step 2: Expected PASS** because `statistics/src/index.ts` re-exports the functions bindings. If it fails, the owner rule is broken: re-export the functions symbol instead of wrapping it. Do not copy the formula.

- [ ] **Step 3: Commit** `docs(statistics): name functions as the distribution owner`

---

## Self-review

Coverage against the spec:

| ID                  | Task                 | Reopened?         |
| ------------------- | -------------------- | ----------------- |
| N4 P0               | MT-1                 | no                |
| U5, U6 P1           | MT-2                 | no                |
| U7 P1               | MT-3                 | no                |
| U3, U4 P1           | MT-4                 | no                |
| U9 P1               | MT-6                 | no                |
| D1 P1               | D1                   | no                |
| D2 P1               | MT-9                 | no                |
| U2 P2               | MT-8                 | no                |
| U10 P2              | MT-7                 | no                |
| N5 P2               | MT-10 optional       | no                |
| D4 P2               | D4 optional          | no                |
| D5 P2               | D5 docs              | no                |
| D6 P2               | D6 lock only         | no                |
| D7 P2               | D7 docs + binding    | no                |
| U8 policy           | MT-5 not implemented | no                |
| U1, U12, N1, N2, N3 | none                 | closed, not tasks |

Placeholder scan: no TBD. The D1 test contains the full `searchScalars` call. Type names (`AmbiguousUnitError`, `reading: 'difference'`, `mapUnit`, `cycles`, `bit: 'ln2'`) match the spec.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-05-upt-integration-gaps.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks.

**2. Inline Execution** — execute tasks in one session with checkpoints.

Which approach?
