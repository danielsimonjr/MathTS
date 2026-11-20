---
'@danielsimonjr/mathts-functions': patch
---

`simplify` folds `gcd` and `lcm` of constants to the mathjs values. `simplify` folds a constant as a Fraction. The Fraction signature of `gcd` called `Fraction.gcd()`, which takes no argument and returns `1n`, so `simplify('gcd(4,6)')` gave `1` and `simplify('gcd(12,18)+x')` threw `JSON.stringify cannot serialize BigInt`. The Fraction signature of `lcm` called a method that `Fraction` does not have, so `simplify('lcm(1/2,1/3)*x')` stayed unevaluated. Both signatures now use the fraction.js definition: gcd(a/b, c/d) = gcd(a, c) / lcm(b, d), and lcm(a/b, c/d) = lcm(a, c) / gcd(b, d). The results are `2`, `x + 6` and `x`. `replacer` now writes a bigint as `{"mathjs":"bigint","value":"5"}`, as mathjs does, and `simplify` uses the same replacer, so `simplify('2*x+3*x')` on an instance with `number: 'bigint'` gives `5 * x` and does not throw. `reviver` reads that tag back as a bigint. (Refs #1321)
