---
'@danielsimonjr/mathts-functions': patch
---

`quantileSeq` of numbers now finds the one or two order statistics by selection and does not sort. It reads the values into one `Float64Array` in one pass. A flat array is not flattened first. On 1e6 numbers, `quantileSeq(a, 0.9)` took 1685 ms and now takes 37 ms. The time of `median` is 25 ms on the same machine.

A list of probabilities, or an N, reads the values and scans for NaN once. From 24 probabilities the values are sorted once with the native typed-array sort.

(Refs #1005)
