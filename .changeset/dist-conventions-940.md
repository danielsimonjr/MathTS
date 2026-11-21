---
'@danielsimonjr/mathts-functions': patch
---

The distribution constructors (`normalDist`, `gammaDist`, `exponentialDist` and the 18 others) throw a `TypeError` for an options object after their last parameter, for a value with no numeric reading in a number position (an array too), and (`gammaDist`, `sampleN`) for an unknown option key. Before, `gammaDist(2, 2, { scale: 2 })` gave the rate distribution with no error. A call from `Array.prototype.map`, an explicit `undefined`, a BigNumber parameter and a missing parameter do not change. Each constructor documents its SciPy equivalent. (Refs #940)
