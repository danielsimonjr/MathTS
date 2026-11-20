---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-expression': patch
---

Four small defects of the CAS and of the LaTeX output are fixed (Refs #1014; item 3, `symbolicEqual('(x+1)^2', 'x^2+2*x+1')`, is fixed with #1178).

- `factor` of a polynomial with rational coefficients: `factor('x^2/2-1/2')` returned the input. It now returns `(x - 1)*(x + 1)/2`. The factor of the integer polynomial that the common denominator gives is divided by that denominator. `x^2-1/4` gives `(2*x - 1)*(2*x + 1)/4` and `2*x/3-2/3` gives `2*(x - 1)/3`. An irreducible polynomial (`x^2/2+1/2`) is returned as it is. The content path of `factor` also cut a number literal: `2*x/3-2/3` gave `2*(x/3 + -/3)`, `2^3*x+4` gave `2*(^3*x + 2)` and `4*x+2.5*y` gave `2*(2*x + .5*y)`, all with a wrong value. It now returns the input for these. It writes a negative term as `x - 1`, not `x + -1`.
- `symbolicPartialDerivative('x^2*y', 'x')` returned `d/dx(x^2*y)`. The term reader of the function cannot read a power of the variable with another symbol, so it leaves that placeholder. For such an input the function now returns the derivative of the expression tree: `2 * y * x`. A term that the term reader reads keeps its text.
- `realRoots([1, -3, 2])` returned `[0.49999999999272404, 1.0000000000218279]`: the bisection stops at a relative bracket width of 1e-10 and returned the middle. Newton steps inside the bracket now polish each root: the result is `[0.5, 1]`, and `[-6, 11, -6, 1]` gives `[1, 2, 3]`. A double root keeps the accuracy of the bisection. The documentation of `realRoots` states the order of the coefficients (ascending), the meaning of `tol` and the order of the roots (ascending, each once). `solve` of a polynomial uses `realRoots`, so its roots are more exact.
- The LaTeX of an operator that is a command (`\neg`, `\cdot`, `\wedge`, `\mod`) is no longer joined to an operand that starts with a letter: `parse('not true').toTex()` was `\negtrue` and is now `\neg true`. `2*true` gives `2\cdot true`. A digit and a symbol are not changed (`\neg1`, `\neg a`). (Refs #1014)
