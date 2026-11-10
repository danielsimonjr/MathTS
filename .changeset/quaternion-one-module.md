---
'@danielsimonjr/mathts-functions': patch
---

The quaternion functions are in one module and accept a quaternion of any non-zero magnitude. `quaternionRotate`, `quaternionToRotationMatrix`, `quaternionSlerp`, `quaternionToEuler` and `quaternionLog` gave a wrong result for a non-unit quaternion: they now read the quaternion as the rotation of its unit form. `quaternionToEuler` gives angles that rebuild the rotation at pitch ±90°. `quaternionFromAxisAngle` throws on a zero or non-finite axis, and the functions that divide by the magnitude throw on the zero quaternion. The exported names and signatures are the same.
