---
'@danielsimonjr/mathts-functions': minor
---

Welch PSD, cross-spectral density, and coherence now use a DFT-periodic window and subtract the mean of each segment by default, matching SciPy. Pass `{ periodic: false, detrend: false }` to select the previous convention.
