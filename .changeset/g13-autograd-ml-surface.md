---
'@danielsimonjr/mathts-autograd': minor
---

Fix repeated `Tape.backward()` gradient accumulation (stale intermediate cotangent slots). Add `detach`, `Tape.noGrad`, `reshape`, ReLU/GELU/softmax/cross-entropy on `TapedTensor`, rank-N `grad()` input, and honest README limits. Seal the tape after `backward()` until `reset()` to prevent unbounded graph growth.
