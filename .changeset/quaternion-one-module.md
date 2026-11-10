---
'@danielsimonjr/mathts-functions': patch
---

The quaternion functions are in one module and accept a quaternion of any finite, non-zero magnitude, components near `1e200` or `1e-200` included. `quaternionRotate`, `quaternionToRotationMatrix`, `quaternionSlerp`, `quaternionToEuler` and `quaternionLog` gave a wrong result for a non-unit quaternion. The functions now read the quaternion as the rotation of its unit form. `quaternionToEuler` gives angles that rebuild the rotation at pitch ±90°. `quaternionFromAxisAngle` throws on a zero or non-finite axis. The functions that divide by the magnitude throw on the zero quaternion and on a quaternion that is not finite. The exported names and signatures are the same.
