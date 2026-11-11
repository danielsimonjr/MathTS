---
'@danielsimonjr/mathts-functions': minor
---

Add `mat3ToQuat`, an allocation-free conversion of a column-major 3x3 rotation matrix to a unit quaternion `[w, x, y, z]` (Shepperd method). It uses the out-parameter style of the vec3/quat/mat3 kernels, and its result equals the rotation of `mat4Decompose` bit for bit.
