---
'@danielsimonjr/mathts-core': patch
---

Unit reading: a glued digit power starts with 1 to 9, so `m0K` and `m01K` give no reading and `Unit.parse('1 m0K')` throws. A superscript plus is a caret plus: `m⁺²K` gives `m^2·K`.
