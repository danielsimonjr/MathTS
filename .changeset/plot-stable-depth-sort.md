---
'@danielsimonjr/mathts-plot': patch
---

3-D surface: quads whose depths differ by at most 1e-9 are drawn in face-index order. Before, the order depended on the last bit of `Math.sin`, which differs between runtimes. SVG output can differ from 0.4.2 for exactly tied quads only.
