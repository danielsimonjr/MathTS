---
'@danielsimonjr/mathts-functions': patch
---

The general `eigs` of a defective BigNumber or Complex matrix with small entries gives no false eigenvector. The null space solver tests each coupling against the entries of its row, with a tolerance of one twentieth of `precision`, not against an absolute tolerance. This is a trade for a dense matrix with a double eigenvalue. Of 20 seeded dense BigNumber matrices `P D P^-1` per scale (order 3 to 5, a double eigenvalue), 20, 20 and 19 keep every eigenvector at the scales 1, 2^40 and 2^-60. A count can change between runs, because inverse iteration starts from a random vector. A lost eigenvector is a missing one, not a false one. (Refs #1242)
