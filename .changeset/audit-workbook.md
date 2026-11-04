---
'@danielsimonjr/mathts-workbook': patch
---

`--json` envelopes no longer print a shared, non-circular object as "[Circular]" the second time it appears; only a true cycle does. `topologicalSort`, `getDependents` and `getAncestors` are iterative, so a chain of tens of thousands of cells no longer overflows the stack. The executor looks cells up in a map, and in reactive mode a batch run (`runAll`, `runReport`) no longer emits `cell:stale` for dependents that run later in the same batch. `WorkbookSession` reuses its dependency graph and finds the cells affected by an edit in one traversal.
