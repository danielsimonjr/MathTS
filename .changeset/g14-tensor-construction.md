---
'@danielsimonjr/mathts-tensor': minor
---

**Breaking (runtime):** `new Tensor(shape, data)` now throws `TypeError` unless `data` is a `Float64Array` (no silent acceptance of `Float32Array`, plain arrays, or array-likes).

**Added:** `Tensor.fromNested(nested)` infers rectangular shape when the shape argument is omitted.

**Fixed:** `flip(t, axis)` accepts a single axis number like NumPy/PyTorch; `stack(tensors)` defaults `axis` to `0` like `np.stack`.
