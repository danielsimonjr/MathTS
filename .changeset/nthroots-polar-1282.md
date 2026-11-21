---
'@danielsimonjr/mathts-functions': patch
---

`nthRoots` returns roots with number parts. Before, each root off the axes had the object `{ r, phi }` as its real part, because the call `new Complex({ r, phi })` reached a constructor that takes `(re, im)`. Each root now comes from `Complex.fromPolar`, and the local constructor type declares the real signature, so the compiler can see a wrong call. (Refs #1282)
