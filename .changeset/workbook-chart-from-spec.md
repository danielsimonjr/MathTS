---
'@danielsimonjr/mathts-workbook': patch
---

Security: the HTML, TeX and notebook exporters now make chart markup from the chart settings and data of each cell. A chart cell no longer carries markup, so an export writes no markup that the caller supplies.
