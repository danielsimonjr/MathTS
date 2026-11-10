---
'@danielsimonjr/mathts-core': patch
---

`Unit.readings` and `Unit.parse` search a glued unit token in one pass. A token with many partial readings and no full reading no longer takes a time that doubles with each two characters. The readings and their order are the same.
