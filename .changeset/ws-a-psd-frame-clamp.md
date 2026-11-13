---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-signal': patch
---

`welchPSD`, `bartlettPSD`, `stft` and `spectrogram` clamp a defaulted frame length (`frameLength`, `nperseg`, `windowSize`) to the signal length, as `scipy.signal.welch` clamps `nperseg`, so a 64-sample signal returns a 33-bin spectrum. An explicit frame longer than the signal still throws (`spectrogram` returns no frames). A frame that is not a power of two uses an exact-length DFT in `welchPSD`, `bartlettPSD`, `stft` and `istft`, so bin `k` is at `k / frameLength` and an `stft` frame has `nperseg` bins; `istft` reads the frame width from its input, and `istft(stft(x))` reconstructs the signal. `stft([])` returns no frames. `spectrogram` no longer throws for a one-sample window or loops for a `hopSize` below 1 (#897).
