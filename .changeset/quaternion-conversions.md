---
'@danielsimonjr/mathts-functions': minor
---

Three new quaternion conversions: `quaternionToAxisAngle`, `quaternionFromRotationMatrix` and `quaternionFromEuler`. Each new function is the inverse of a function that the package has: `quaternionFromAxisAngle`, `quaternionToRotationMatrix` and `quaternionToEuler`. `quaternionToAxisAngle` gives a unit axis and an angle in `[0, π]`. `quaternionFromRotationMatrix` uses the method of Shepperd.
