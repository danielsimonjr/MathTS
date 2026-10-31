---
'@danielsimonjr/mathts-functions': patch
---

Speed up dense QR Householder decomposition on plain number matrices by routing inner loops through cached number typed-function implementations, with generic fallback and step resume when a reflection scalar leaves the number domain.
