/**
 * Expression-language transforms (wired 2026-07-05 — formerly a dormant pocket).
 *
 * Inside the expression language, several functions behave differently than the
 * programmatic API: indices and dimensions are ONE-based, logical operators
 * short-circuit lazily (`rawArgs`), and `index()`/ranges convert to the
 * zero-based internals. Each factory takes its BASE function as an injected
 * dependency (the host — e.g. the functions package — supplies its own
 * implementation), rather than importing a parallel implementation layer.
 */
export { createAndTransform } from './and.transform.js';
export { createBitAndTransform } from './bitAnd.transform.js';
export { createBitOrTransform } from './bitOr.transform.js';
export { createColumnTransform } from './column.transform.js';
export { createConcatTransform } from './concat.transform.js';
export { createCumSumTransform } from './cumsum.transform.js';
export { createDiffTransform } from './diff.transform.js';
export { createFilterTransform } from './filter.transform.js';
export { createForEachTransform } from './forEach.transform.js';
export { createIndexTransform } from './index.transform.js';
export { createMapTransform } from './map.transform.js';
export { createMapSlicesTransform } from './mapSlices.transform.js';
export { createMaxTransform } from './max.transform.js';
export { createMeanTransform } from './mean.transform.js';
export { createMinTransform } from './min.transform.js';
export { createNullishTransform } from './nullish.transform.js';
export { createOrTransform } from './or.transform.js';
export { createPrintTransform } from './print.transform.js';
export { createQuantileSeqTransform } from './quantileSeq.transform.js';
export { createRangeTransform } from './range.transform.js';
export { createRowTransform } from './row.transform.js';
export { createStdTransform } from './std.transform.js';
export { createSubsetTransform } from './subset.transform.js';
export { createSumTransform } from './sum.transform.js';
export { createVarianceTransform } from './variance.transform.js';
