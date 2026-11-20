---
'@danielsimonjr/mathts-functions': patch
---

The general `eigs` of a defective BigNumber or Complex matrix with small entries gives no false eigenvector. The null space solver tests each coupling against the entries of its row, with a tolerance of one twentieth of `precision`, not against an absolute tolerance. This is a trade for a dense matrix with a double eigenvalue. On a set of 60 dense matrices `P D P^-1` per cell (order 3 to 5, a double eigenvalue, the scales 1, 2^40 and 2^-60), the count of matrices that keep every eigenvector changes from 60/59/59 to 60/60/52 for BigNumber entries and from 46/41/60 to 56/57/53 for Complex entries. A count can change by 1 between runs, because inverse iteration starts from a random vector. A lost eigenvector is a missing one, not a false one. (Refs #1242)
