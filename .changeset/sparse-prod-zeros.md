---
'@danielsimonjr/mathts-functions': patch
---

The sparse matrix `forEach` visits every element by default, column by column, as mathjs does. It visits only the stored entries when `skipZeros` is true. `prod` of a sparse matrix with an implicit zero is now 0, and the reductions that read through `forEach` include the implicit zeros, as mathjs does (#985).
