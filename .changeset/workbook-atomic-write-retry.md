---
'@danielsimonjr/mathts-workbook': patch
---

Retry the atomic write's rename a few times when another process holds the target open (EPERM, EBUSY, EACCES on Windows), so a `meta set`, `strip -w` or `cell` write does not fail while a scanner reads the file.
