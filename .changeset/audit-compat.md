---
'@danielsimonjr/mathts-compat': patch
---

`create()` wraps each function with the instance config on first access instead of wrapping all of them up front. Wrappers are memoized (`math.add === math.add`), and `Object.keys(math)` is unchanged.
