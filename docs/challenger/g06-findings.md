# G06 challenger findings — PR #1767 (#1554)

Oracle: `mathjs@15.3.0` (the `compat` devDependency). Harness: `expectSame` /
`pair` in `compat/tests/parity/oracle.ts` — `typeOf` + `format(v, {precision:
14})`, or error name + first message clause.

Reproduce all of the below with:

```bash
cd compat && bunx vitest run tests/parity/challenger-g06.test.ts
```

On the builder head: **16 failed | 9 passed**. The 9 passing are regression
guards for the rows the PR did fix; they must stay green after the fixes.

## Policy verdict — PASS

`git diff --stat origin/main` touches only `compat/`, `docs/api/compat.md`,
`.changeset/`, `changelog-fragments/` and `tools/test/bundle-budget.json`. No
critical library (`typed-function`, `core`, `matrix`, `functions`, `workpool`,
`gpu`, `parallel`) is changed. The approach is the correct one per Daniel's
policy: critical libraries keep native behavior; the mathjs parity lives in
compat adapters.

No `as never` / `as any` / `: any` / `@ts-ignore` / `@ts-expect-error` in
shipped `compat/src` code. The only casts are `as unknown as` at two test choke
points (the repo's documented convention).

## D1 — P0, REGRESSION (introduced by #1767)

`bernoulli` of a non-`number` index crashes at index **0, 1, and every odd
index**.

```js
// mathjs 15.3.0            // compat (PR #1767)
bernoulli(0n)          => Fraction 1/1     // TypeError: Cannot read properties of undefined (reading '2')
bernoulli(1n)          => Fraction -1/2    // TypeError ...
bernoulli(3n)          => Fraction 0/1     // TypeError ...
bernoulli(fraction(0)) => Fraction 1/1     // TypeError ...
bernoulli(bignumber(1))=> BigNumber -0.5   // TypeError ...
evaluate('bernoulli(3)') under {number:'BigNumber'} => BigNumber 0   // TypeError ...
evaluate('bernoulli(1)') under {number:'Fraction'}  => Fraction -1/2 // TypeError ...
```

**Root cause.** `bernoulliCore` in `compat/src/mathjs-parity-g06.ts` ports
mathjs's `_bernoulli` recurrence but **omits the three early returns** the
mathjs original has before it:

```js
if (index === 0) return promote(1);
if (index === 1) return divide(promote(-1), promote(2));
if (index % 2 === 1) return promote(0);
```

For `index === 0` (and any odd index) the recurrence loop never fills
`cache[half]`, so `return cache[half]![2]` throws. The `!` non-null assertion
hides exactly this.

**Why it matters.** On `origin/main` these calls returned a _number_ (wrong type,
no crash). #1767 upgrades the wrong type into a hard `TypeError`, and the crash
is reachable through the `evaluate` path the PR advertises. Index `1`
(`-1/2`) and every odd Bernoulli number (`0`) are the most basic cases of the
function — the existing G06 test only checks even indexes (2, 4, 12), which is
why it stayed green.

**Fix.** Restore the three early returns in `bernoulliCore` (they belong there
for all three type lanes; the Fraction/BigNumber lanes share the function).

## D2 — P2, pre-existing gap still in #1554's scope

`compare(BigNumber, Fraction)` (either order) must throw
`TypeError: Cannot implicitly convert a Fraction to BigNumber or vice versa.`
Compat coerces and returns a BigNumber.

```js
compare(bignumber(2), fraction(1, 3));
// mathjs: TypeError: Cannot implicitly convert a Fraction to BigNumber or vice versa...
// compat: BigNumber 1
```

`createCompatCompare` only guards Complex. Adding the BigNumber/Fraction mixed
guard is the same shape of fix. Not a regression (main behaves the same) but the
"compare matches mathjs" claim in the changeset is incomplete.

## D3 — P2, undocumented dense form of a documented gap

`pinv([[0, 1]])` (dense) must throw
`Error: Cannot calculate inverse, determinant is zero`; compat returns
`[[0],[1]]`. `docs/api/compat.md` records only the **sparse**
`pinv(sparse([[0,1]]))` case; the dense form diverges identically and is not
documented.

## D4 — P2, claimed "residual" that is actually wrappable

`bernoulli` on the **number** path diverges from mathjs from n ≈ 192 onward.
First divergence n = 192 (last-digit rounding); from n = 198 mathjs overflows:

```js
bernoulli(200); // mathjs: -Infinity      compat: -3.6470772645192e+215
bernoulli(1000); // mathjs: NaN            compat: -Infinity
```

`docs/api/compat.md` says "Small and moderate indexes match", which is false.

The PR calls this out of scope ("delegates the number path to native
`functions` `bernoulli`"). It is **not** out of scope: `bernoulliCore` already
in this file reproduces mathjs's exact float recurrence for any type, so the
number path can route through the same cache and match mathjs bit-for-bit,
including the Infinity/NaN overflow. No critical library needs to change.

## Scope answers

- **`bernoulli(1e6)`**: with D4's fix the number path routes through
  `bernoulliCore`, so it matches mathjs without touching a critical library. Not
  an out-of-scope native difference. (Both engines are O(n²)-ish: mathjs
  `bernoulli(100000)` takes ~1.8 s; the compat path is the same recurrence, so
  parity, not speed, is the point.)
- **Sparse 1×2 `pinv`**: the divergence is in the shared native `matrix` SVD
  path (the same code returns a matrix for the dense `[[0,1]]` form), so it is
  NOT a compat-only wrap: matching mathjs's `inv`-then-catch rref strategy would
  mean reimplementing mathjs's `pinv` algorithm in compat for the zero-vector
  case. That one is legitimately a native-difference residual; but the DENSE
  form (D3) should be documented alongside the sparse one, since both come from
  the same cause and both are visible.

## Summary

| ID  | Severity | Regression?     | Repro                                                                        |
| --- | -------- | --------------- | ---------------------------------------------------------------------------- |
| D1  | **P0**   | **Yes** (#1767) | `bernoulli(0n)`, `bernoulli(1n)`, any odd index — TypeError crash            |
| D2  | P2       | No              | `compare(bignumber(2), fraction(1,3))` returns BigNumber instead of throwing |
| D3  | P2       | No              | dense `pinv([[0,1]])` returns a matrix instead of throwing                   |
| D4  | P2       | No              | `bernoulli(200)` returns finite instead of `-Infinity`; doc claim wrong      |
