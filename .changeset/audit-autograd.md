---
'@danielsimonjr/mathts-autograd': minor
---

Binary `TapedTensor` ops throw a clear error when their operands come from different `Tape`s. `Tape.backward` replays only the nodes up to the output op. Add `Tape.reset()` to clear recorded nodes, closures and gradient slots.
