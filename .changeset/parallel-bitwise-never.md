---
'@danielsimonjr/mathts-parallel': patch
---

WS-2 addendum: the seven bitwise ops (`bitAnd`/`bitOr`/`bitXor`/`bitNot`/`leftShift`/`rightArithShift`/`rightLogShift`) gated via a **nameless** `shouldParallelize(len)` — the untested global 50 000 threshold. Benchmarked (`tools/benchmarks/ws2-bitwise-ops.mjs`, medians of 9 interleaved reps): the worker path loses 7–25× at every size up to 4M elements (0.04–0.15× — Int32Array element-wise is maximally memory-bound). All seven are now named `OpName`s set to `'never'`, and the methods pass their op name so the entries govern — inline execution for every caller (a speedup at ≥50k sizes that previously dispatched to workers). Worker-kernel test coverage is preserved via an explicit per-op-map override in the forced-parallel suite.
