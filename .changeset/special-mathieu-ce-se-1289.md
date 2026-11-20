---
'@danielsimonjr/mathts-functions': patch
---

`mathieuCe(n, q, x)` and `mathieuSe(n, q, x)` are correct for a large `q` and a high order. They summed a 50-harmonic series, so `mathieuSe(100, 1e3, 0.4)` was 1.2043 and not -1.0101, and `mathieuCe(0, 1e6, 1.5)` was -0.0482 and not 0.0420. They now use the matrix of `mathieuA` and `mathieuB` (sized to `n` and `q`), the eigenvalue by Sturm bisection and the eigenvector by inverse iteration. A call that needs more than `MAX_MATHIEU_HARMONICS` (1e6; `|q|` above about 1.8e19 at `n = 3` and about 5e17 at `n = 99`) throws a RangeError: `mathieuCe(3, 1e30, 0)` returned the wrong value -0.0062. A NaN `q` gives NaN. The sign is the sign of DLMF 28.2(vi), continued from `q = 0`: `ce_n(0, q) > 0` and `se_n'(0, q) > 0` for every `q`. The old rule (coefficient `m` positive) gave the opposite sign from `q` about 25 on, for example `mathieuCe(2, 100, 0.3)` and `mathieuSe(4, 1e4, 1.2)`. (Refs #1289)
