---
'@danielsimonjr/mathts-functions': patch
---

`mathieuA(n, q)` and `mathieuB(n, q)` are correct for a large `q` and a high order. The 50-harmonic matrix gave wrong values (`mathieuA(3, 1e6)` was -1981206.54 and not -1986006.25, `mathieuA(99, 1e8)` was +199904592.8 and not -196024956.4, `mathieuA(99, 1)` was 9801.0025 and not 9801.00005); both functions now use a matrix sized to `n` and `q` and one Sturm-bisection eigenvalue, so `mathieuA(99, 1e8)` is -196024956.4264. For `|q| >= max(1e5, 10 (2n+1)^4)` they use the asymptotic series of DLMF 28.8.1, so `mathieuA(3, 1e10)` and `mathieuA(3, 1e100)` (-2e100) cost no more than `mathieuA(3, 1e6)`. A negative `q` follows DLMF 28.2.21. `mathieuA(n, 0)` is `n^2`, an infinite `q` gives `-Infinity` and a NaN `q` gives NaN. (Refs #1105)
