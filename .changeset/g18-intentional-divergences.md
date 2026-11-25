---
'@danielsimonjr/mathts-compat': patch
---

Documented intentional divergences from mathjs for `zeta`, `symbolicEqual`, and `range` (#1585): compat keeps the more accurate values (`zeta(-3)` = 1/120, finite complex `zeta`, BigNumber `zeta(4)` closer to π⁴/90, `symbolicEqual('x*y','y*x')` true, BigNumber `range('4:10')` including 10). Each is documented under `Intentional divergences` in `docs/api/compat.md` and pinned against the mathjs 15.3.0 value in `compat/tests/parity/g18-intentional.test.ts`. No source function changed.
