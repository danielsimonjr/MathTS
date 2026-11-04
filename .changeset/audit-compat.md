---
'@danielsimonjr/mathts-compat': patch
---

`create()` wraps each function with the instance config on first access instead of wrapping all of them up front. Wrappers are memoized (`math.add === math.add`), `Object.keys(math)` is unchanged, and a frozen instance keeps working (the wrapper is served from a closure when the property cannot be redefined).
