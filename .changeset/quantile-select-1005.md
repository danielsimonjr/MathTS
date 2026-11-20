---
'@danielsimonjr/mathts-functions': patch
---

`quantileSeq` of numbers now finds the one or two order statistics by selection and does not sort. It reads the values into one `Float64Array` in one pass. A flat array is not flattened first. On 1e6 numbers, `quantileSeq(a, 0.9)` took 1685 ms and now takes 37 ms. The time of `median` is 25 ms on the same machine.

A list of probabilities, or an N, reads the values and scans for NaN once. From 24 probabilities the values are sorted once with the native typed-array sort.

For a range of more than 64 values, the selection chooses its pivot at pseudo-random positions and sorts the rest of the range after a pass budget. A sorted array that is rotated, an organ-pipe array and a repeated pattern no longer give a bad split on every pass. With a fixed pivot, `quantileSeq(a, 0.9)` of 1e6 values that were sorted and rotated by a third took 19 s. It now takes 47 ms. `median`, `quickSelect`, `medianSelect`, `minSelect` and `maxSelect` use the same selection: `quickSelect` of 1e5 values that were sorted and rotated by a half took 4.3 s at k = 9e4 and now takes 65 ms.

(Refs #1005)
