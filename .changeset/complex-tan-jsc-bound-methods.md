---
'@danielsimonjr/mathts-core': patch
---

Fix the JavaScriptCore (Bun) slowdown of `Complex.tan/cot/tanh/coth` from P6-5. The four methods keep one closed form, but it is now bound once per method, when `Complex` is defined, instead of taking two boolean flags on every call through a shared helper. Results are bit-identical to the P6-5 pin.
