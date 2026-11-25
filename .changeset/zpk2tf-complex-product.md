---
'@danielsimonjr/mathts-compat': patch
---

Match mathjs 15.3.0 `Complex` non-finite arithmetic (complex.js 2.4.3) on the compat instance only: wrapped `add`/`subtract`/`multiply`/`divide`/`dotMultiply`, `freqz`/`zpk2tf` via compat complex.js signal factories, expression `evaluate` scope wiring for those shims, and doc-sweep config isolation (#1589). Native critical packages are unchanged.
