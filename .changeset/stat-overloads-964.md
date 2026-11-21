---
'@danielsimonjr/mathts-functions': patch
---

The public types of `median`, `mode` and `mad` give the number type for a `readonly number[]` argument, and `median('x')`, `median({})`, `median()`, `mad()`, `mode()` and `mode(array, 0)` are compile errors. A spread of a plain array (`median(...xs)`) and a list of strings (`mode('a', 'a', 'b')`) no longer compile: pass the array. At run time, `mode` of a Matrix inside the argument list throws a `TypeError` in place of the false NaN message. `parallelFFT`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `dct`, `dst`, `hilbertTransform`, `polymul`, `newtonInterp`, `polyFit` and the other callers of the shared sample copy throw a `TypeError` for an array entry with no numeric reading (a nested array, an object, `undefined`, a string that is no number). A BigNumber, a Fraction and a numeric string entry still convert. (Refs #964)
