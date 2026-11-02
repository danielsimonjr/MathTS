---
'@danielsimonjr/mathts-core': minor
---

psi and torr take SI prefixes (kpsi, mtorr). The parser refuses dB, dBm, dBW, Np, Mach and mach with a reason instead of reporting them as not found, and exports the reasons as REFUSED_UNIT_SPELLINGS.
