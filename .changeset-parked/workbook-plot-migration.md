---
'@danielsimonjr/mathts-workbook': patch
---

Migrate workbook chart rendering onto @danielsimonjr/mathts-plot; the private svg.ts plotter is removed in favor of a thin adapter delegating to the plot package.
