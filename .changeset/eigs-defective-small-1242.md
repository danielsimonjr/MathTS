---
'@danielsimonjr/mathts-functions': patch
---

The general `eigs` of a defective BigNumber or Complex matrix with small entries gives no false eigenvector. The null space solver tests each coupling against the entries of its row, with a tolerance of one hundredth of `precision`, not against an absolute tolerance. (Refs #1242)
