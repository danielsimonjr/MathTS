---
'@danielsimonjr/mathts-functions': patch
---

`gammaDist` reads a BigNumber or a Fraction second argument as the rate. Before, it read that argument as an options object and threw, so `evaluate('gammaDist(2, 2)')` failed in a scope with `number: 'BigNumber'`. (Refs #1360)
