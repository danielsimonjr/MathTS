---
'@danielsimonjr/mathts-core': patch
---

Fix JavaScriptCore regression for `Complex.tan/cot/tanh/coth` by using straight-line method bodies (no shared `tanFamily` boolean dispatch). Bit identity unchanged vs the P6-5 pin.
