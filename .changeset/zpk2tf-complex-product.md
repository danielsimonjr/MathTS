---
'@danielsimonjr/mathts-compat': patch
---

Match mathjs 15.3.0 `Complex` non-finite arithmetic (complex.js 2.4.3) on the compat instance only: wrapped `add`/`subtract`/`multiply`/`divide`/`dotMultiply`, `freqz` via compat complex.js signal factory, `zpk2tf` via mathjs oracle delegation, expression `evaluate` scope wiring for those shims, and doc-sweep config isolation (#1589). Native critical packages are unchanged.