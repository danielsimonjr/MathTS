---
'@danielsimonjr/mathts-functions': patch
---

The general `eigs` converges for a real matrix with a complex conjugate pair when the entries are BigNumber or Complex. The QR iteration takes a double-shift step when the trailing 2x2 block has a complex pair, and a Complex matrix takes the Wilkinson shift. The 2x2 block solver scales a block with entries above 2^500 or below 2^-500, so the discriminant does not overflow. (Refs #1238)
