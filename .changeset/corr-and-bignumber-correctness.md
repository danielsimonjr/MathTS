---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': minor
---

Fix `corr` catastrophic cancellation and a class of BigNumber correctness bugs

**`corr` could return values outside [-1, 1].** The Pearson correlation used the one-pass
"computational formula" `n·ΣXY − ΣX·ΣY`, which subtracts two nearly-equal large quantities and
catastrophically cancels when the data has a large mean: `corr` of two ~1e9 series returned **52**
(mathematically impossible) for a true value of **−1**. Rewritten to the numerically stable
**two-pass** form (center by the mean, then `Σdx·dy / sqrt(Σdx²·Σdy²)`), with a pairwise-accurate
plain-number fast path. Now matches `np.corrcoef` (verified against live NumPy).

**Core BigNumber comparisons silently mishandled plain-number arguments.** `equals`, `lessThan`,
`lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, and `compareTo` passed their argument
straight to the internal comparator without coercion, so `bignumber(8).lessThanOrEqual(3)` returned
`true`. They now coerce (`number`/`string` → `BigNumber`) exactly like `add`/`gt` already did.

**The mathjs-lineage factory layer assumed a decimal.js BigNumber API that core does not implement**
(`plus`/`minus`/`dividedBy`/`lte`/`gte`/`lt`/`eq`/`cmp`), so many factory functions crashed or
mis-ordered on BigNumbers. Fixed across arithmetic (`addScalar`, `subtractScalar`), all comparison
and relational helpers (`nearlyEqual`, `compare`, `smaller`, `smallerEq`, `largerEq`, `equalScalar`)
— restoring `sort`/`median`/`min`/`max` on BigNumber arrays — plus `cumsum`, `quantileSeq`,
`factorial`, `gamma`, and `isPrime`. `isPrime`'s Miller-Rabin and `gamma`'s factorial both dropped
their decimal.js precision-cloning dance (core's BigNumber is bigint-backed, so integer arithmetic
is already exact). Also fixed a non-idempotent `bignumber()` conversion: `bignumber(aBigNumber)`
returned `Infinity` (it re-ran `fromNumber` on an object), which corrupted every consumer that
re-wraps a possibly-BigNumber value.

No public API removals. These paths were previously **untested** (which is why they stayed broken
under a green suite); regression tests added in `core/tests/bignumber-comparison-coercion.test.ts`
and `functions/tests/bignumber-operations.test.ts`.
