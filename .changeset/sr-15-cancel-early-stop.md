---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts an opt-in `signal: AbortSignal`, checked before the initial population and between generations (never mid-draw): already aborted before the first yield the result carries an empty front and `evaluations: 0`; aborted after a yield the last progress is returned as the result, both with the new `stopReason: 'cancelled'`, and a pool the search owns is still terminated. It also accepts opt-in `earlyStop: { loss, generations }`: once the best finite hall loss has been `<= loss` for `generations` consecutive generations (hall after the generation, initial population included) the run ends with `stopReason: 'early-stop'`. Omitted, both options change nothing and the seed-7 pin is unchanged.
