---
'@danielsimonjr/mathts-autograd': patch
---

Document that `TapedTensor.binaryCrossEntropy` takes logits, not probabilities, returns one loss per element, and exists only as a method (Refs #1017). Before: the JSDoc said only "with logits" and `docs/api/autograd.md` omitted the method. After: both state the formula, the shapes, the gradient (`sigmoid(x) - t`) and the `[0.8, 0.3]` worked example. No behaviour change.
