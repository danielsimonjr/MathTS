---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-signal': patch
---

`welchPSD` and `bartlettPSD` clamp a defaulted `frameLength` to the signal length, as `scipy.signal.welch` clamps `nperseg`, so a 64-sample signal returns a 33-bin spectrum. An explicit `frameLength` longer than the signal still throws. `stft` clamps a defaulted `nperseg`, and `istft` reads the frame width from its input. A non-power-of-two frame uses an exact-length DFT, so bin `k` is at `k / frameLength` (#897).
