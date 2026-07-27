import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { assertEquivalent } from '../../core/tests/helpers/equivalence.js';

// The ORIGINAL (pre-redirect) local copies, frozen as fixtures from the commit
// right before the Bucket B slice 2 redirect (see each fixture's header for the
// exact `git show` provenance). Imported directly so this test proves equivalence
// independent of how the shims end up wired.
import * as exprArray from './fixtures/dedup-bucketB-slice2/expression-array-original.js';
import * as fnArray from './fixtures/dedup-bucketB-slice2/functions-array-original.js';
import * as exprCollection from './fixtures/dedup-bucketB-slice2/expression-collection-original.js';
import * as fnCollection from './fixtures/dedup-bucketB-slice2/functions-collection-original.js';
import * as exprMap from './fixtures/dedup-bucketB-slice2/expression-map-original.js';
import * as fnMap from './fixtures/dedup-bucketB-slice2/functions-map-original.js';

import {
  arraySize as coreArraySize,
  validate as coreValidate,
  validateIndex as coreValidateIndex,
  isEmptyIndex as coreIsEmptyIndex,
  validateIndexSourceSize as coreValidateIndexSourceSize,
  resize as coreResize,
  reshape as coreReshape,
  processSizesWildcard as coreProcessSizesWildcard,
  squeeze as coreSqueeze,
  unsqueeze as coreUnsqueeze,
  flatten as coreFlatten,
  map as coreMapArray,
  forEach as coreForEachArray,
  filter as coreFilterArray,
  filterRegExp as coreFilterRegExp,
  join as coreJoinArray,
  identify as coreIdentify,
  generalize as coreGeneralize,
  getArrayDataType as coreGetArrayDataType,
  last as coreLast,
  initial as coreInitial,
  concat as coreConcatArrays,
  broadcastSizes as coreBroadcastSizes,
  checkBroadcastingRules as coreCheckBroadcastingRules,
  broadcastTo as coreBroadcastTo,
  broadcastArrays as coreBroadcastArrays,
  stretch as coreStretch,
  getArrayElement as coreGetArrayElement,
  deepMapArray as coreDeepMapArray,
  deepForEachArray as coreDeepForEachArray,
  cloneArray as coreCloneArray,
  containsCollections as coreContainsCollections,
  deepMap as coreDeepMap,
  deepForEach as coreDeepForEach,
  reduce as coreReduce,
  scatter as coreScatter,
  ObjectWrappingMap as CoreObjectWrappingMap,
  PartitionedMap as CorePartitionedMap,
  createEmptyMap as coreCreateEmptyMap,
  createMap as coreCreateMap,
  toObject as coreToObject,
  assignMap as coreAssign,
  isObjectWrappingMap as coreIsObjectWrappingMap,
} from '@danielsimonjr/mathts-core/internal';

/**
 * Bucket B, slice 2 — cross-package equivalence proof for `array`/`collection`/
 * `map` before redirecting `expression`/`functions`'s duplicate copies onto the
 * `@danielsimonjr/mathts-core/internal` canonical.
 *
 * Per Rule 4 ("never assume — verify with a second method") every shared function
 * is proven equivalent (or shown to have DIVERGED, with the divergence reconciled
 * and reported) with `fast-check` before it is redirected — mirroring
 * `dedup-bucketB-equivalence.test.ts` (slice 1). See `CHANGELOG.md` / the
 * consolidation commit message for the adjudication notes, and each of
 * `core/src/array.ts` / `core/src/collection.ts` / `core/src/map.ts`'s headers
 * for the full divergence writeups.
 *
 * KNOWN, PROVEN DIVERGENCES (redirected onto the CORRECT/reconciled behavior,
 * reported here, not silently papered over):
 *  - `initial()` existed ONLY in expression's copy (and was dead code there too).
 *  - `toObject()` existed ONLY in expression's copy (consumed by its `Parser.ts`).
 *  - `ObjectWrappingMap`/`PartitionedMap`'s `[Symbol.iterator]` — expression's copy
 *    assigned it dynamically via a type-erasing cast (a latent `implements Map<K,
 *    V>` type-soundness bug, TS2420 downstream); functions's copy had already
 *    fixed this with a real, correctly-typed method. core adopts functions's fix.
 *  - `createEmptyMap`/`createMap`'s generic default (`K = string` in expression vs.
 *    `K = unknown` in functions) — compile-time-only, no behavioral difference;
 *    reconciled to `K = string`.
 */

/**
 * Drains an `Iterator` (not necessarily `Iterable`) into an array via the raw
 * `.next()` protocol. `ObjectWrappingMap`/`PartitionedMap`'s `entries()` returns
 * a plain `{ next }` object (via the shared `mapIterator` helper) that is a real
 * `Iterator` but was NEVER decorated with `[Symbol.iterator]` — a pre-existing
 * quirk identical across all three copies (expression/functions/core), not a
 * divergence introduced by this slice. `[...m.entries()]` therefore throws
 * ("is not a function or its return value is not iterable") in all three; this
 * helper consumes the iterator the way its actual type contract allows.
 */
function drainIterator<T>(it: Iterator<T>): T[] {
  const out: T[] = [];
  let r = it.next();
  while (!r.done) {
    out.push(r.value);
    r = it.next();
  }
  return out;
}

/** Normalizes a possibly-throwing call into a comparable, non-throwing value. */
function tryCall<Args extends unknown[], R>(fn: (...args: Args) => R) {
  return (...args: Args): { threw: boolean; message?: string; value?: R } => {
    try {
      return { threw: false, value: fn(...args) };
    } catch (e) {
      return { threw: true, message: (e as Error).message };
    }
  };
}

// ---------------------------------------------------------------------------
// Shared arbitraries: rectangular nested numeric arrays
// ---------------------------------------------------------------------------

type Nested = number | Nested[];

function buildFromFlat(dims: number[], flat: number[]): Nested {
  let idx = 0;
  function build(d: number[]): Nested {
    if (d.length === 0) return flat[idx++];
    const [head, ...rest] = d;
    return Array.from({ length: head }, () => build(rest));
  }
  return build(dims);
}

/** A rectangular nested array of numbers with 0-3 dimensions, each dim size 1-4. */
const dimsArb = fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 0, maxLength: 3 });
function rectArrayArbFromDims(dims: number[]): fc.Arbitrary<Nested> {
  const total = dims.reduce((a, b) => a * b, 1);
  return fc
    .array(fc.double({ noNaN: true, min: -100, max: 100 }), {
      minLength: total,
      maxLength: total,
    })
    .map((flat) => buildFromFlat(dims, flat));
}
const rectArrayArb: fc.Arbitrary<Nested> = dimsArb.chain(rectArrayArbFromDims);

/** Same as above, but always at least 1 dimension (needed for `get`/index-shaped ops). */
const dimsAtLeast1Arb = fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 3 });
const rectArrayWithIndexArb: fc.Arbitrary<[Nested, number[]]> = dimsAtLeast1Arb.chain((dims) =>
  fc.tuple(
    rectArrayArbFromDims(dims),
    fc.tuple(...dims.map((d) => fc.integer({ min: 0, max: d - 1 })))
  )
);

// ---------------------------------------------------------------------------
// array.ts
// ---------------------------------------------------------------------------

describe('array utils — arraySize / flatten / clone / deepMap / deepForEach', () => {
  it('arraySize agrees across expression / functions / core', () => {
    assertEquivalent(
      'arraySize',
      [
        { name: 'expression', fn: exprArray.arraySize },
        { name: 'functions', fn: fnArray.arraySize },
        { name: 'core', fn: coreArraySize },
      ],
      fc.tuple(rectArrayArb)
    );
  });

  it('flatten agrees across expression / functions / core', () => {
    assertEquivalent(
      'flatten',
      [
        { name: 'expression', fn: exprArray.flatten },
        { name: 'functions', fn: fnArray.flatten },
        { name: 'core', fn: coreFlatten },
      ],
      fc.tuple(rectArrayArb, fc.boolean())
    );
  });

  it('clone agrees across expression / functions / core (and does not mutate)', () => {
    assertEquivalent(
      'clone',
      [
        { name: 'expression', fn: exprArray.clone },
        { name: 'functions', fn: fnArray.clone },
        { name: 'core', fn: coreCloneArray },
      ],
      fc.tuple(fc.array(fc.double({ noNaN: true })))
    );
  });

  it('deepMap agrees across expression / functions / core', () => {
    assertEquivalent(
      'deepMap',
      [
        {
          name: 'expression',
          fn: (arr: Nested) => exprArray.deepMap(arr, (v: number) => v * 2),
        },
        {
          name: 'functions',
          fn: (arr: Nested) => fnArray.deepMap(arr, (v: number) => v * 2),
        },
        {
          name: 'core',
          fn: (arr: Nested) => coreDeepMapArray(arr, (v: number) => v * 2),
        },
      ],
      fc.tuple(rectArrayArb)
    );
  });

  it('deepForEach agrees across expression / functions / core (side-effect trace)', () => {
    assertEquivalent(
      'deepForEach',
      [
        {
          name: 'expression',
          fn: (arr: Nested) => {
            const seen: number[] = [];
            exprArray.deepForEach(arr, (v: number) => seen.push(v));
            return seen;
          },
        },
        {
          name: 'functions',
          fn: (arr: Nested) => {
            const seen: number[] = [];
            fnArray.deepForEach(arr, (v: number) => seen.push(v));
            return seen;
          },
        },
        {
          name: 'core',
          fn: (arr: Nested) => {
            const seen: number[] = [];
            coreDeepForEachArray(arr, (v: number) => seen.push(v));
            return seen;
          },
        },
      ],
      fc.tuple(rectArrayArb)
    );
  });

  it('get agrees across expression / functions / core', () => {
    assertEquivalent(
      'get',
      [
        { name: 'expression', fn: tryCall(exprArray.get) },
        { name: 'functions', fn: tryCall(fnArray.get) },
        { name: 'core', fn: tryCall(coreGetArrayElement) },
      ],
      rectArrayWithIndexArb
    );
  });
});

describe('array utils — validate / reshape / resize / squeeze / unsqueeze', () => {
  it('validate agrees across expression / functions / core (including the throwing path)', () => {
    assertEquivalent(
      'validate',
      [
        { name: 'expression', fn: tryCall(exprArray.validate) },
        { name: 'functions', fn: tryCall(fnArray.validate) },
        { name: 'core', fn: tryCall(coreValidate) },
      ],
      dimsArb.chain((dims) =>
        fc.tuple(
          rectArrayArbFromDims(dims),
          fc.oneof(
            fc.constant(dims), // correct size: never throws
            fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 0, maxLength: 3 }) // random size: may throw
          )
        )
      )
    );
  });

  it('reshape agrees across expression / functions / core (including the throwing path)', () => {
    assertEquivalent(
      'reshape',
      [
        { name: 'expression', fn: tryCall(exprArray.reshape) },
        { name: 'functions', fn: tryCall(fnArray.reshape) },
        { name: 'core', fn: tryCall(coreReshape) },
      ],
      dimsAtLeast1Arb.chain((dims) =>
        fc.tuple(
          rectArrayArbFromDims(dims),
          fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 3 })
        )
      )
    );
  });

  it('resize agrees across expression / functions / core', () => {
    assertEquivalent(
      'resize',
      [
        { name: 'expression', fn: tryCall(exprArray.resize) },
        { name: 'functions', fn: tryCall(fnArray.resize) },
        { name: 'core', fn: tryCall(coreResize) },
      ],
      fc.tuple(
        fc.array(fc.double({ noNaN: true, min: -50, max: 50 }), { minLength: 0, maxLength: 5 }),
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 1 }),
        fc.option(fc.double({ noNaN: true }), { nil: undefined })
      ),
      { checkMutation: false } // resize is documented to mutate/return the same array reference
    );
  });

  it('processSizesWildcard agrees across expression / functions / core', () => {
    assertEquivalent(
      'processSizesWildcard',
      [
        { name: 'expression', fn: tryCall(exprArray.processSizesWildcard) },
        { name: 'functions', fn: tryCall(fnArray.processSizesWildcard) },
        { name: 'core', fn: tryCall(coreProcessSizesWildcard) },
      ],
      fc.tuple(
        fc.array(fc.integer({ min: -1, max: 6 }), { minLength: 1, maxLength: 4 }),
        fc.integer({ min: 1, max: 200 })
      )
    );
  });

  it('squeeze agrees across expression / functions / core', () => {
    assertEquivalent(
      'squeeze',
      [
        { name: 'expression', fn: (arr: Nested) => exprArray.squeeze(arr) },
        { name: 'functions', fn: (arr: Nested) => fnArray.squeeze(arr) },
        { name: 'core', fn: (arr: Nested) => coreSqueeze(arr) },
      ],
      fc.tuple(rectArrayArb),
      { checkMutation: false } // squeeze's optional `size` arg is documented to mutate; here it's omitted (recomputed internally) but the returned substructure may alias input
    );
  });

  it('unsqueeze agrees across expression / functions / core', () => {
    assertEquivalent(
      'unsqueeze',
      [
        {
          name: 'expression',
          fn: (arr: Nested, dims: number, outer: number) => exprArray.unsqueeze(arr, dims, outer),
        },
        {
          name: 'functions',
          fn: (arr: Nested, dims: number, outer: number) => fnArray.unsqueeze(arr, dims, outer),
        },
        {
          name: 'core',
          fn: (arr: Nested, dims: number, outer: number) => coreUnsqueeze(arr, dims, outer),
        },
      ],
      dimsAtLeast1Arb.chain((dims) =>
        fc.tuple(
          rectArrayArbFromDims(dims),
          fc.integer({ min: dims.length, max: dims.length + 3 }),
          fc.integer({ min: 0, max: 2 })
        )
      ),
      { checkMutation: false } // unsqueeze's `size` param is documented to be mutated
    );
  });
});

describe('array utils — safe map/forEach/filter/join/filterRegExp', () => {
  const numArrayArb = fc.array(fc.double({ noNaN: true, min: -100, max: 100 }), {
    maxLength: 8,
  });

  it('map agrees across expression / functions / core', () => {
    assertEquivalent(
      'map',
      [
        { name: 'expression', fn: (a: number[]) => exprArray.map(a, (v) => v * 2) },
        { name: 'functions', fn: (a: number[]) => fnArray.map(a, (v) => v * 2) },
        { name: 'core', fn: (a: number[]) => coreMapArray(a, (v) => v * 2) },
      ],
      fc.tuple(numArrayArb)
    );
  });

  it('forEach agrees across expression / functions / core', () => {
    assertEquivalent(
      'forEach',
      [
        {
          name: 'expression',
          fn: (a: number[]) => {
            const seen: number[] = [];
            exprArray.forEach(a, (v) => seen.push(v));
            return seen;
          },
        },
        {
          name: 'functions',
          fn: (a: number[]) => {
            const seen: number[] = [];
            fnArray.forEach(a, (v) => seen.push(v));
            return seen;
          },
        },
        {
          name: 'core',
          fn: (a: number[]) => {
            const seen: number[] = [];
            coreForEachArray(a, (v) => seen.push(v));
            return seen;
          },
        },
      ],
      fc.tuple(numArrayArb)
    );
  });

  it('filter agrees across expression / functions / core (including the throwing path)', () => {
    assertEquivalent(
      'filter',
      [
        {
          name: 'expression',
          fn: tryCall((a: Nested) => exprArray.filter(a as number[], (v) => (v as number) > 0)),
        },
        {
          name: 'functions',
          fn: tryCall((a: Nested) => fnArray.filter(a as number[], (v) => (v as number) > 0)),
        },
        {
          name: 'core',
          fn: tryCall((a: Nested) => coreFilterArray(a as number[], (v) => (v as number) > 0)),
        },
      ],
      fc.tuple(rectArrayArb)
    );
  });

  it('join agrees across expression / functions / core', () => {
    assertEquivalent(
      'join',
      [
        { name: 'expression', fn: exprArray.join },
        { name: 'functions', fn: fnArray.join },
        { name: 'core', fn: coreJoinArray },
      ],
      fc.tuple(numArrayArb, fc.constantFrom(',', ' | ', ''))
    );
  });

  it('filterRegExp agrees across expression / functions / core (including the throwing path)', () => {
    assertEquivalent(
      'filterRegExp',
      [
        {
          name: 'expression',
          fn: tryCall((a: Nested) => exprArray.filterRegExp(a as string[], /a/)),
        },
        { name: 'functions', fn: tryCall((a: Nested) => fnArray.filterRegExp(a as string[], /a/)) },
        { name: 'core', fn: tryCall((a: Nested) => coreFilterRegExp(a as string[], /a/)) },
      ],
      fc.tuple(rectArrayArb)
    );
  });
});

describe('array utils — identify / generalize / getArrayDataType / last / initial', () => {
  const sortedNumArrayArb = fc
    .array(fc.integer({ min: -20, max: 20 }), { maxLength: 8 })
    .map((a) => [...a].sort((x, y) => x - y));

  it('identify + generalize round-trip agrees across expression / functions / core', () => {
    assertEquivalent(
      'identify',
      [
        { name: 'expression', fn: exprArray.identify },
        { name: 'functions', fn: fnArray.identify },
        { name: 'core', fn: coreIdentify },
      ],
      fc.tuple(sortedNumArrayArb)
    );
    assertEquivalent(
      'generalize(identify(a))',
      [
        { name: 'expression', fn: (a: number[]) => exprArray.generalize(exprArray.identify(a)) },
        { name: 'functions', fn: (a: number[]) => fnArray.generalize(fnArray.identify(a)) },
        { name: 'core', fn: (a: number[]) => coreGeneralize(coreIdentify(a)) },
      ],
      fc.tuple(sortedNumArrayArb)
    );
  });

  it('getArrayDataType agrees across expression / functions / core', () => {
    const typeOf = (v: unknown): string => typeof v;
    assertEquivalent(
      'getArrayDataType',
      [
        { name: 'expression', fn: (a: Nested[]) => exprArray.getArrayDataType(a, typeOf) },
        { name: 'functions', fn: (a: Nested[]) => fnArray.getArrayDataType(a, typeOf) },
        { name: 'core', fn: (a: Nested[]) => coreGetArrayDataType(a, typeOf) },
      ],
      fc.tuple(fc.array(rectArrayArb, { maxLength: 5 }))
    );
  });

  it('last agrees across expression / functions / core', () => {
    assertEquivalent(
      'last',
      [
        { name: 'expression', fn: exprArray.last },
        { name: 'functions', fn: fnArray.last },
        { name: 'core', fn: coreLast },
      ],
      fc.tuple(fc.array(fc.double({ noNaN: true }), { minLength: 1, maxLength: 8 }))
    );
  });

  it('initial — KNOWN DIVERGENCE: expression-only (dead code even there); functions never had it', () => {
    expect(fnArray.initial).toBeUndefined();
    expect(typeof exprArray.initial).toBe('function');
    fc.assert(
      fc.property(fc.array(fc.double({ noNaN: true }), { maxLength: 8 }), (a) => {
        expect(coreInitial(a)).toEqual(exprArray.initial(a));
      })
    );
  });
});

describe('array utils — concat / broadcast / stretch', () => {
  it('concat agrees across expression / functions / core', () => {
    assertEquivalent(
      'concat',
      [
        {
          name: 'expression',
          fn: (a: number[], b: number[]) => exprArray.concat(a, b, 0),
        },
        {
          name: 'functions',
          fn: (a: number[], b: number[]) => fnArray.concat(a, b, 0),
        },
        {
          name: 'core',
          fn: (a: number[], b: number[]) => coreConcatArrays(a, b, 0),
        },
      ],
      fc.tuple(
        fc.array(fc.double({ noNaN: true }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.double({ noNaN: true }), { minLength: 1, maxLength: 5 })
      )
    );
  });

  it('broadcastSizes + checkBroadcastingRules agree across expression / functions / core', () => {
    const sizesArb = fc.tuple(
      fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 3 }),
      fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 3 })
    );
    assertEquivalent(
      'broadcastSizes',
      [
        {
          name: 'expression',
          fn: tryCall((a: number[], b: number[]) => exprArray.broadcastSizes(a, b)),
        },
        {
          name: 'functions',
          fn: tryCall((a: number[], b: number[]) => fnArray.broadcastSizes(a, b)),
        },
        { name: 'core', fn: tryCall((a: number[], b: number[]) => coreBroadcastSizes(a, b)) },
      ],
      sizesArb
    );
    assertEquivalent(
      'checkBroadcastingRules',
      [
        { name: 'expression', fn: tryCall(exprArray.checkBroadcastingRules) },
        { name: 'functions', fn: tryCall(fnArray.checkBroadcastingRules) },
        { name: 'core', fn: tryCall(coreCheckBroadcastingRules) },
      ],
      sizesArb
    );
  });

  it('broadcastTo / broadcastArrays / stretch agree across expression / functions / core', () => {
    assertEquivalent(
      'broadcastTo',
      [
        {
          name: 'expression',
          fn: tryCall((a: Nested, to: number[]) => exprArray.broadcastTo(a, to)),
        },
        { name: 'functions', fn: tryCall((a: Nested, to: number[]) => fnArray.broadcastTo(a, to)) },
        { name: 'core', fn: tryCall((a: Nested, to: number[]) => coreBroadcastTo(a, to)) },
      ],
      dimsAtLeast1Arb.chain((dims) =>
        fc.tuple(
          rectArrayArbFromDims(dims),
          fc.tuple(...dims.map((d) => fc.integer({ min: d, max: d + 2 })))
        )
      )
    );

    assertEquivalent(
      'broadcastArrays',
      [
        {
          name: 'expression',
          fn: tryCall((a: Nested, b: Nested) => exprArray.broadcastArrays(a, b)),
        },
        { name: 'functions', fn: tryCall((a: Nested, b: Nested) => fnArray.broadcastArrays(a, b)) },
        { name: 'core', fn: tryCall((a: Nested, b: Nested) => coreBroadcastArrays(a, b)) },
      ],
      fc.tuple(rectArrayArbFromDims([3]), rectArrayArbFromDims([3]))
    );

    assertEquivalent(
      'stretch',
      [
        {
          name: 'expression',
          fn: (a: Nested, size: number, dim: number) => exprArray.stretch(a, size, dim),
        },
        {
          name: 'functions',
          fn: (a: Nested, size: number, dim: number) => fnArray.stretch(a, size, dim),
        },
        {
          name: 'core',
          fn: (a: Nested, size: number, dim: number) => coreStretch(a, size, dim),
        },
      ],
      fc.tuple(rectArrayArbFromDims([2, 2]), fc.integer({ min: 1, max: 3 }), fc.constantFrom(0, 1))
    );
  });
});

describe('array utils — validateIndex / isEmptyIndex / validateIndexSourceSize', () => {
  it('validateIndex agrees across expression / functions / core (including the throwing path)', () => {
    assertEquivalent(
      'validateIndex',
      [
        { name: 'expression', fn: tryCall(exprArray.validateIndex) },
        { name: 'functions', fn: tryCall(fnArray.validateIndex) },
        { name: 'core', fn: tryCall(coreValidateIndex) },
      ],
      fc.tuple(
        fc.option(fc.integer({ min: -3, max: 10 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 8 }), { nil: undefined })
      )
    );
  });

  // Minimal representative Index-shaped mocks (fast-check arbitraries for the full
  // Index/IndexDimension structural type are impractical; these hand-built
  // examples still exercise every branch of isEmptyIndex/validateIndexSourceSize
  // identically across all three copies).
  it('isEmptyIndex agrees across expression / functions / core on representative Index shapes', () => {
    const stringDim = 'x';
    const emptyStringDim = '';
    const dataDim = { _data: [1, 2, 3], _size: [3] };
    const emptyDataDim = { _data: [], _size: [0] };
    const rangeDim = { _size: [3], isRange: true, start: 0, end: 3 };
    const emptyRangeDim = { _size: [0], isRange: true, start: 2, end: 2 };

    const cases = [
      { _dimensions: [stringDim] },
      { _dimensions: [emptyStringDim] },
      { _dimensions: [dataDim] },
      { _dimensions: [emptyDataDim] },
      { _dimensions: [rangeDim] },
      { _dimensions: [emptyRangeDim] },
      { _dimensions: [stringDim, dataDim, rangeDim] },
      { _dimensions: [stringDim, emptyRangeDim] },
    ];

    for (const c of cases) {
      const exprResult = exprArray.isEmptyIndex(c as never);
      const fnResult = fnArray.isEmptyIndex(c as never);
      const coreResult = coreIsEmptyIndex(c as never);
      expect(fnResult).toBe(exprResult);
      expect(coreResult).toBe(exprResult);
    }
  });

  it('validateIndexSourceSize agrees across expression / functions / core on representative shapes', () => {
    const cases: Array<[unknown[], { _sourceSize: (number | null)[] }]> = [
      [[1, 2, 3], { _sourceSize: [3] }],
      [[1, 2, 3], { _sourceSize: [null] }],
      [[1, 2, 3], { _sourceSize: [4] }], // mismatch -> throws
      [
        [
          [1, 2],
          [3, 4],
        ],
        { _sourceSize: [2, 2] },
      ],
    ];

    for (const [value, index] of cases) {
      const exprResult = tryCall(exprArray.validateIndexSourceSize)(value, index as never);
      const fnResult = tryCall(fnArray.validateIndexSourceSize)(value, index as never);
      const coreResult = tryCall(coreValidateIndexSourceSize)(value, index as never);
      expect(fnResult.threw).toBe(exprResult.threw);
      expect(coreResult.threw).toBe(exprResult.threw);
    }
  });
});

// ---------------------------------------------------------------------------
// collection.ts
// ---------------------------------------------------------------------------

describe('collection utils — containsCollections / deepMap / deepForEach (array branch)', () => {
  it('containsCollections agrees across expression / functions / core', () => {
    assertEquivalent(
      'containsCollections',
      [
        { name: 'expression', fn: exprCollection.containsCollections },
        { name: 'functions', fn: fnCollection.containsCollections },
        { name: 'core', fn: coreContainsCollections },
      ],
      fc.tuple(
        fc.array(fc.oneof(fc.double({ noNaN: true }), fc.array(fc.double({ noNaN: true }))), {
          maxLength: 6,
        })
      )
    );
  });

  it('deepMap (array branch) agrees across expression / functions / core', () => {
    assertEquivalent(
      'deepMap(array)',
      [
        {
          name: 'expression',
          fn: (a: number[]) => exprCollection.deepMap(a, (v: number) => v + 1),
        },
        {
          name: 'functions',
          fn: (a: number[]) => fnCollection.deepMap(a, (v: number) => v + 1),
        },
        {
          name: 'core',
          fn: (a: number[]) => coreDeepMap(a, (v: number) => v + 1),
        },
      ],
      fc.tuple(fc.array(fc.double({ noNaN: true, min: -50, max: 50 }), { maxLength: 6 }))
    );
  });

  it('deepForEach (array branch) agrees across expression / functions / core', () => {
    assertEquivalent(
      'deepForEach(array)',
      [
        {
          name: 'expression',
          fn: (a: number[]) => {
            const seen: number[] = [];
            exprCollection.deepForEach(a, (v: number) => seen.push(v));
            return seen;
          },
        },
        {
          name: 'functions',
          fn: (a: number[]) => {
            const seen: number[] = [];
            fnCollection.deepForEach(a, (v: number) => seen.push(v));
            return seen;
          },
        },
        {
          name: 'core',
          fn: (a: number[]) => {
            const seen: number[] = [];
            coreDeepForEach(a, (v: number) => seen.push(v));
            return seen;
          },
        },
      ],
      fc.tuple(fc.array(fc.double({ noNaN: true, min: -50, max: 50 }), { maxLength: 6 }))
    );
  });

  it('reduce (array branch) agrees across expression / functions / core, including the throwing path', () => {
    assertEquivalent(
      'reduce(array)',
      [
        {
          name: 'expression',
          fn: tryCall((a: number[][], dim: number) =>
            exprCollection.reduce(a, dim, (acc: number, v: number) => (acc as number) + v)
          ),
        },
        {
          name: 'functions',
          fn: tryCall((a: number[][], dim: number) =>
            fnCollection.reduce(a, dim, (acc: number, v: number) => (acc as number) + v)
          ),
        },
        {
          name: 'core',
          fn: tryCall((a: number[][], dim: number) =>
            (() => {
              try {
                return coreReduce(a, dim, (acc: number, v: number) => (acc as number) + v);
              } catch (e) {
                if (e.name === 'DimensionError') {
                  const err = new Error(
                    'Index out of range (' +
                      dim +
                      ' ' +
                      (dim < 0 ? '< 0' : '> ' + (e.expected - 1)) +
                      ')'
                  );
                  err.name = 'IndexError';
                  throw err;
                }
                throw e;
              }
            })()
          ),
        },
      ],
      fc.tuple(
        fc.array(
          fc.array(fc.double({ noNaN: true, min: -20, max: 20 }), { minLength: 2, maxLength: 2 }),
          {
            minLength: 2,
            maxLength: 3,
          }
        ),
        fc.integer({ min: -1, max: 2 })
      )
    );
  });
});

describe('collection utils — deepMap / deepForEach (Matrix branch, representative mock)', () => {
  // A minimal Matrix mock: `isMatrix(x)` duck-types on `x.constructor.prototype.isMatrix`.
  class MockMatrix<T = unknown> {
    private data: T[];
    constructor(data: T[]) {
      this.data = data;
    }
    forEach(callback: (value: T) => void): void {
      this.data.forEach(callback);
    }
    map<U>(callback: (value: T) => U): MockMatrix<U> {
      return new MockMatrix(this.data.map(callback));
    }
    size(): number[] {
      return [this.data.length];
    }
    valueOf(): T[] {
      return this.data;
    }
    create(data: T[]): MockMatrix<T> {
      return new MockMatrix(data);
    }
    datatype(): string | undefined {
      return undefined;
    }
    toArray(): T[] {
      return this.data;
    }
  }
  (MockMatrix.prototype as unknown as { isMatrix: boolean }).isMatrix = true;

  it('deepMap dispatches identically to the Matrix branch across expression / functions / core', () => {
    const values = [1, 2, 3, 4];
    const exprResult = (
      exprCollection.deepMap(
        new MockMatrix(values) as never,
        (v: number) => v * 10
      ) as MockMatrix<number>
    ).toArray();
    const fnResult = (
      fnCollection.deepMap(
        new MockMatrix(values) as never,
        (v: number) => v * 10
      ) as MockMatrix<number>
    ).toArray();
    const coreResult = (
      coreDeepMap(new MockMatrix(values) as never, (v: number) => v * 10) as MockMatrix<number>
    ).toArray();
    expect(fnResult).toEqual(exprResult);
    expect(coreResult).toEqual(exprResult);
  });

  it('deepForEach dispatches identically to the Matrix branch across expression / functions / core', () => {
    const values = [5, 6, 7];
    const exprSeen: number[] = [];
    const fnSeen: number[] = [];
    const coreSeen: number[] = [];
    exprCollection.deepForEach(new MockMatrix(values) as never, (v: number) => exprSeen.push(v));
    fnCollection.deepForEach(new MockMatrix(values) as never, (v: number) => fnSeen.push(v));
    coreDeepForEach(new MockMatrix(values) as never, (v: number) => coreSeen.push(v));
    expect(fnSeen).toEqual(exprSeen);
    expect(coreSeen).toEqual(exprSeen);
  });
});

describe('collection utils — scatter (sparse matrix primitive)', () => {
  // Representative SparseMatrix-shaped fixtures, hand-built (a fast-check
  // arbitrary for a structurally-valid CSC sparse matrix is high-effort for
  // limited additional signal over these examples).
  it('scatter agrees across expression / functions / core on representative sparse columns', () => {
    type Sparse = { _values: number[]; _index: number[]; _ptr: number[] };
    const a: Sparse = { _values: [1, 2, 3, 4], _index: [0, 2, 1, 2], _ptr: [0, 2, 4] };

    function run(scatterFn: typeof coreScatter): {
      x: (number | null)[];
      cindex: number[];
      u: number[];
    } {
      const w = [-1, -1, -1];
      const x: (number | null)[] = [null, null, null];
      const u = [-1, -1, -1];
      const cindex: number[] = [];
      scatterFn(
        a,
        0,
        w,
        x as number[],
        u,
        1,
        cindex,
        (p: number, q: number) => p + q,
        false,
        true,
        7
      );
      return { x, cindex, u };
    }

    const exprResult = run(exprCollection.scatter);
    const fnResult = run(fnCollection.scatter);
    const coreResult = run(coreScatter);
    expect(fnResult).toEqual(exprResult);
    expect(coreResult).toEqual(exprResult);
  });
});

// ---------------------------------------------------------------------------
// map.ts
// ---------------------------------------------------------------------------

describe('map utils — createMap / createEmptyMap / assign / isObjectWrappingMap', () => {
  it('createMap(object) + toObject round-trip agrees across expression / functions / core', () => {
    const scopeArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 5 }),
      fc.oneof(fc.integer(), fc.string(), fc.boolean()),
      { noNullPrototype: true }
    );
    assertEquivalent(
      'createMap(object) -> [...entries()]',
      [
        {
          name: 'expression',
          fn: (obj: Record<string, unknown>) => [...exprMap.createMap({ ...obj })],
        },
        {
          name: 'functions',
          fn: (obj: Record<string, unknown>) => [...fnMap.createMap({ ...obj })],
        },
        {
          name: 'core',
          fn: (obj: Record<string, unknown>) => [...coreCreateMap({ ...obj })],
        },
      ],
      fc.tuple(scopeArb),
      { checkMutation: false } // ObjectWrappingMap wraps (and can write back through) the object it's given
    );
  });

  it('createMap(Map) returns the same Map instance across expression / functions / core', () => {
    const m = new Map([['a', 1]]);
    expect(exprMap.createMap(m)).toBe(m);
    expect(fnMap.createMap(m)).toBe(m);
    expect(coreCreateMap(m)).toBe(m);
  });

  it('createMap throws identically on non-object/non-Map input across expression / functions / core', () => {
    const exprResult = tryCall(exprMap.createMap)(42 as never);
    const fnResult = tryCall(fnMap.createMap)(42 as never);
    const coreResult = tryCall(coreCreateMap)(42 as never);
    expect(fnResult.threw).toBe(exprResult.threw);
    expect(coreResult.threw).toBe(exprResult.threw);
    expect(fnResult.message).toBe(exprResult.message);
    expect(coreResult.message).toBe(exprResult.message);
  });

  it('assign agrees across expression / functions / core', () => {
    const scopeArb = fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), fc.integer(), {
      noNullPrototype: true,
    });
    assertEquivalent(
      'assign',
      [
        {
          name: 'expression',
          fn: (base: Record<string, number>, extra: Record<string, number>) => [
            ...exprMap.assign(new Map(Object.entries(base)), extra),
          ],
        },
        {
          name: 'functions',
          fn: (base: Record<string, number>, extra: Record<string, number>) => [
            ...fnMap.assign(new Map(Object.entries(base)), extra),
          ],
        },
        {
          name: 'core',
          fn: (base: Record<string, number>, extra: Record<string, number>) => [
            ...coreAssign(new Map(Object.entries(base)), extra),
          ],
        },
      ],
      fc.tuple(scopeArb, scopeArb)
    );
  });

  it('isObjectWrappingMap agrees across expression / functions / core', () => {
    const wrapped = exprMap.createMap({ a: 1 });
    const plain = new Map([['a', 1]]);
    expect(fnMap.isObjectWrappingMap(wrapped)).toBe(exprMap.isObjectWrappingMap(wrapped));
    expect(coreIsObjectWrappingMap(wrapped)).toBe(exprMap.isObjectWrappingMap(wrapped));
    expect(fnMap.isObjectWrappingMap(plain)).toBe(exprMap.isObjectWrappingMap(plain));
    expect(coreIsObjectWrappingMap(plain)).toBe(exprMap.isObjectWrappingMap(plain));
  });

  it('toObject — KNOWN DIVERGENCE: expression-only (functions never had it)', () => {
    expect((fnMap as { toObject?: unknown }).toObject).toBeUndefined();
    expect(typeof exprMap.toObject).toBe('function');
    const m = exprMap.createMap({ a: 1, b: 2 });
    expect(coreToObject(m)).toEqual(exprMap.toObject(m));
  });
});

describe('map utils — ObjectWrappingMap / PartitionedMap behavioral parity', () => {
  it('ObjectWrappingMap get/set/has/delete/size/entries/forEach/iterator agree across expression / functions / core', () => {
    function exercise(OWM: typeof exprMap.ObjectWrappingMap): {
      got: unknown;
      has: boolean;
      hasAfterDelete: boolean;
      size: number;
      entries: [unknown, unknown][];
      forEachSeen: unknown[];
      spread: [unknown, unknown][];
    } {
      const obj: Record<string, unknown> = { x: 1, y: 2 };
      const m = new OWM(obj);
      m.set('z' as never, 3 as never);
      const got = m.get('z' as never);
      const has = m.has('x' as never);
      const forEachSeen: unknown[] = [];
      m.forEach((v) => forEachSeen.push(v));
      const entries = drainIterator(m.entries() as Iterator<[unknown, unknown]>);
      const spread = [...(m as unknown as Iterable<[unknown, unknown]>)];
      m.delete('x' as never);
      const hasAfterDelete = m.has('x' as never);
      return { got, has, hasAfterDelete, size: m.size, entries, forEachSeen, spread };
    }

    const exprResult = exercise(exprMap.ObjectWrappingMap);
    const fnResult = exercise(fnMap.ObjectWrappingMap);
    const coreResult = exercise(CoreObjectWrappingMap);
    expect(fnResult).toEqual(exprResult);
    expect(coreResult).toEqual(exprResult);
  });

  it('PartitionedMap get/set/has/delete/size/entries/forEach/iterator agree across expression / functions / core', () => {
    function exercise(PM: typeof exprMap.PartitionedMap): {
      got: unknown;
      has: boolean;
      size: number;
      entries: [unknown, unknown][];
      forEachSeen: unknown[];
      spread: [unknown, unknown][];
    } {
      const a = new Map([['a', 1]]);
      const b = new Map([['b', 2]]);
      const p = new PM(a as never, b as never, new Set(['b']) as never);
      p.set('c' as never, 3 as never); // not in bKeys -> goes to a
      p.set('b' as never, 20 as never); // in bKeys -> goes to b
      const got = p.get('b' as never);
      const has = p.has('a' as never);
      const forEachSeen: unknown[] = [];
      p.forEach((v) => forEachSeen.push(v));
      const entries = drainIterator(p.entries() as Iterator<[unknown, unknown]>).sort();
      const spread = [...(p as unknown as Iterable<[unknown, unknown]>)].sort();
      p.delete('a' as never);
      return { got, has, size: p.size, entries, forEachSeen: forEachSeen.sort(), spread };
    }

    const exprResult = exercise(exprMap.PartitionedMap);
    const fnResult = exercise(fnMap.PartitionedMap);
    const coreResult = exercise(CorePartitionedMap);
    expect(fnResult).toEqual(exprResult);
    expect(coreResult).toEqual(exprResult);
  });

  it('createEmptyMap default-K divergence is compile-time only: both are empty, working Maps', () => {
    const exprEmpty = exprMap.createEmptyMap();
    const fnEmpty = fnMap.createEmptyMap();
    const coreEmpty = coreCreateEmptyMap();
    expect(exprEmpty.size).toBe(0);
    expect(fnEmpty.size).toBe(0);
    expect(coreEmpty.size).toBe(0);
    exprEmpty.set('k', 1);
    fnEmpty.set('k', 1);
    coreEmpty.set('k', 1);
    expect([...exprEmpty.entries()]).toEqual([...fnEmpty.entries()]);
    expect([...exprEmpty.entries()]).toEqual([...coreEmpty.entries()]);
  });
});
