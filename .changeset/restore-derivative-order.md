---
'@danielsimonjr/mathts-functions': minor
---

Restore the `order` option on `derivative()`, and its input validation, after both were
silently removed.

`derivative(expr, x, { order: n })` computes the nth derivative again, and a non-integer or
negative `order` throws `TypeError('Option "order" must be a non-negative integer')` instead
of being accepted. Since the removal, `{ order: 0 }`, `{ order: 2 }` and `{ order: 3 }` all
returned the **first** derivative, and invalid orders were silently ignored.

Also restores the `simplify` default. The guard had become a truthiness test
(`options.simplify ? …`), so passing any options object that omitted `simplify` — including
`{ order: 2 }` — silently disabled simplification. It is `options.simplify !== false` again,
matching the `{ simplify: true }` default that applies when no options are passed.

Both regressions entered in `d25f00a9` ("Fix dynamic code execution vulnerability in the CAS
evaluator"), a 56-file commit that also deleted `functions/tests/derivative.test.ts` — which
is why CI stayed green: the evidence was removed along with the capability. That test is
restored here and fails against the regressed code, so it gates the behaviour from now on.
The genuine security fix in that commit (`functions/src/typed/cas.ts`) is untouched.
