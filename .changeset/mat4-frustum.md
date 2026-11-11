---
'@danielsimonjr/mathts-functions': minor
---

Add allocation-free mat4 and frustum kernels (issue 381): `mat4Multiply`, `mat4Invert`, `mat4Compose`, `mat4Decompose`, `mat4LookAt`, `mat4Perspective` and `mat4Orthographic` (both with a `depthRange` of `'negative-one-to-one'` or `'zero-to-one'`), and `frustumFromMatrix`, `frustumContainsPoint`, `frustumIntersectsSphere` and `frustumIntersectsAabb`. They use the out-parameter style of the vec3/quat/mat3 kernels, and they match fourJS `Matrix4` and `Frustum` bit for bit (fixture test).
