---
'@danielsimonjr/mathts-functions': patch
---

`eigs` of a matrix with Complex entries keeps the imaginary part of each entry (#1220). The factory scope `complex(x)` built `new Complex(x, undefined)`, so a Complex argument became a Complex that held the entry in `re`, and `abs` read it as its modulus. `complex()` now follows mathjs: it clones a Complex, and it accepts a number, BigNumber, Fraction, string, `{re, im}`, `{r, phi}` and an Array. Before: `eigs([[complex(2,1)]])` gave 2.236 (now 2+i); `eigs([[complex(0,1),0],[0,1]])` gave 1, 1 (now i, 1); `diag(2+i, 5+i)` gave 2.236, 5.099 (now 2+i, 5+i); `[[2+i,1],[0,3]]` gave 2.236, 3 (now 2+i, 3); `[[2,1-i],[1+i,3]]` gave 0.9999999999999991, 4.000000000000001 (now 1, 4). The public `complex(complexValue)`, `complex({re, im})` and `complex('2+i')` returned a Complex that held the argument in `re`; they now return the Complex.
