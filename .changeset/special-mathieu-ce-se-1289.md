---
'@danielsimonjr/mathts-functions': patch
---

`mathieuCe(n, q, x)` and `mathieuSe(n, q, x)` are correct for a large `q` and a high order. They summed a 50-harmonic series, so `mathieuSe(100, 1e3, 0.4)` was 1.2043 and not 1.0101, and `mathieuCe(0, 1e6, 1.5)` was -0.0482 and not 0.0420. They now use the matrix of `mathieuA` and `mathieuB` (sized to `n` and `q`), the eigenvalue by Sturm bisection and the eigenvector by inverse iteration. A call that needs more than `MAX_MATHIEU_HARMONICS` (1e6, `|q|` above about 1.8e19) throws a RangeError: `mathieuCe(3, 1e30, 0)` returned the wrong value -0.0062. A NaN `q` gives NaN. (Refs #1289)
