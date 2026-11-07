---
'@danielsimonjr/mathts-core': minor
---

`Unit.parse` accepts glued unit products (`m2K`, `Vs`, `cm^2/Vs`, `NN`) and Unicode superscripts (`K²`, `m⁻¹`). A token that names one unit keeps that reading. A prefix glued to a unit name (`mly`, `mpc`) is refused, and a token with two readings of different dimensions (`mAs`) is still not found.
