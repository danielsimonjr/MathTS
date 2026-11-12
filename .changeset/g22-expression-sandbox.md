---
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
---

Bind Unicode `π` and `√` in the default evaluate scope; throw on IEEE numeric literal overflow, including decimals; keep compiler and dispatch symbols (`parse`, `typed`, `createUnit`, `resolve`, and the other forbidden calls) out of the safe evaluate namespace and out of the namespace expression callbacks compile against; fix expression README MathML sample and sandbox docs.
