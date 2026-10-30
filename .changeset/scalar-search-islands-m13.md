---
'@danielsimonjr/mathts-functions': patch
---

Extend `searchScalars` with multi-island evolution (M13b): `populations` independent islands (`rng.fork('island:' + index)`), migration of other islands' best trees into the worst places of each island (`fractionReplaced`), annealing of the constant-perturbation temperature (`initialTemperature`, times 0.995 per generation), and adaptive parsimony in tournament selection (`adaptiveParsimonyScaling`, compared in log space so a large share cannot overflow). Annealing and adaptive parsimony default to on only when `populations > 1`; `populations: 1` is byte-identical to the single-population search. Invalid `populations`, `fractionReplaced`, `initialTemperature` and `adaptiveParsimonyScaling` now throw a `RangeError`.
