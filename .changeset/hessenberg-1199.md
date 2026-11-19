---
'@danielsimonjr/mathts-functions': patch
---

`hessenbergForm` no longer has an absolute tolerance. Each Householder vector is built from the column divided by its largest absolute entry, so the squares cannot overflow or underflow. A step is skipped only when every entry of its column below the subdiagonal is exactly zero; a NaN or an infinity propagates as before. At scale 2^-60 the reconstruction error was 0.56 and is now about 6e-16. At scale 2^1000 the result was NaN and is now correct. A matrix with entries of size 1 and a tail of size 1e-20 or less lost the tail (error 3 relative to the tail) and now keeps it, with an error below 1e-14 relative to the tail. With A[3][3] = 1e300 the result was NaN and is now correct. Fixes #1199.
