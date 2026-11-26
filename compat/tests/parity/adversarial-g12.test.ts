import { describe, it, expect } from 'vitest';
import { create as mjCreate, all as mjAll } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial probes for G12 (#1567–#1571), the typed-package surface PR.
 *
 * Policy in force (Daniel, 2025-11-25, final):
 *  - mathts-compat (`create(all)`) must match mathjs 15.3.0 exactly, quirks included;
 *  - the critical libraries (typed-function, core, matrix, functions, workpool, GPU,
 *    parallel) must never be changed to match mathjs;
 *  - native packages outside those only adopt a mathjs behavior when it is a genuinely
 *    better idea; mathjs quirks must never change native output.
 *
 * Every `it` here is a real failing test on the PR head `0dd7ef6f`, compared against the
 * pinned 15.3.0 oracle. None is skipped. Findings are numbered F1..Fn in the PR body.
 * (Native-only findings — the expression package's exported classes — live in
 * `expression/tests/parity/adversarial-g12-native.test.ts`.)
 */

type Compat = ReturnType<typeof createCompat>;
/** The parts of the mathjs surface these probes read that its typings do not declare. */
type OracleRuntime = Compat & {
  DimensionError: new (...args: never[]) => Error;
  docs: Record<string, unknown>;
};

const oracle = mjCreate(mjAll) as unknown as OracleRuntime;
const compat = () => createCompat(compatAll) as unknown as Compat;

/** The thrown error's class name and message, as the oracle comparison uses them. */
function throwsWith(fn: () => unknown): { name: string; message: string } {
  try {
    fn();
  } catch (e) {
    const err = e as Error;
    return { name: err.name, message: err.message };
  }
  throw new Error('expected the call to throw');
}

// ---------------------------------------------------------------------------
// F1 (HIGH) — compat `add` of mismatched arrays throws the wrong error class/message.
// G12 changed the typed layer (a critical library) so `add([1,2],[1,2,3])` throws core's
// `DimensionError` with a MathTS-only message ("Dimension mismatch (2 != 3) in
// element-wise operation"). The compat instance is built on that typed layer, so the
// compat surface now reports MathTS's class and text where mathjs 15.3.0 throws a plain
// `Error` with the broadcast "shape mismatch" text. Exact-parity policy ⇒ compat must
// keep mathjs's class and message regardless of what the native typed layer throws.
// ---------------------------------------------------------------------------
describe('F1 compat add: mismatched arrays match mathjs 15.3.0 (class + message)', () => {
  it('add([1,2],[1,2,3]) throws the same error name as mathjs', () => {
    const ours = throwsWith(() => compat().add([1, 2], [1, 2, 3] as unknown as number[]));
    const theirs = throwsWith(() => oracle.add([1, 2], [1, 2, 3] as unknown as number[]));
    expect(ours.name, `compat=${ours.name} mathjs=${theirs.name}`).toBe(theirs.name);
  });

  it('add([1,2],[1,2,3]) throws the same message as mathjs', () => {
    const ours = throwsWith(() => compat().add([1, 2], [1, 2, 3] as unknown as number[]));
    const theirs = throwsWith(() => oracle.add([1, 2], [1, 2, 3] as unknown as number[]));
    expect(ours.message).toBe(theirs.message);
  });

  it('add matrix operands give the same error as mathjs', () => {
    const run = (l: Compat): unknown => l.add(l.matrix([1, 2]), l.matrix([1, 2, 3]));
    const ours = throwsWith(() => run(compat()));
    const theirs = throwsWith(() => run(oracle));
    expect({ name: ours.name, message: ours.message }).toEqual({
      name: theirs.name,
      message: theirs.message,
    });
  });
});

// ---------------------------------------------------------------------------
// F2 (HIGH) — compat `divide` of mismatched arrays throws a different error class AND
// message than mathjs 15.3.0. Compat resolves `divide` through the typed layer's
// vector-multiply guard ("Vectors must have the same length"), where mathjs reports the
// square-matrix guard ("Matrix must be square"). This is pre-existing on main and is NOT
// introduced by G12, but it violates the exact-parity policy and is recorded here.
// ---------------------------------------------------------------------------
describe('F2 compat divide: mismatched arrays match mathjs 15.3.0', () => {
  it('divide([1,2],[1,2,3]) throws the same name and message as mathjs', () => {
    const ours = throwsWith(() => compat().divide([1, 2], [1, 2, 3] as unknown as number[]));
    const theirs = throwsWith(() => oracle.divide([1, 2], [1, 2, 3] as unknown as number[]));
    expect({ name: ours.name, message: ours.message }).toEqual({
      name: theirs.name,
      message: theirs.message,
    });
  });
});

// ---------------------------------------------------------------------------
// F3 (HIGH) — compat `evaluate` of a multi-statement block returns a bare `Array`, not
// mathjs's `ResultSet`. mathjs's `evaluate('1+1\n2+2')` returns a `ResultSet`
// (`isResultSet` true, `.toJSON()` = {mathjs:'ResultSet',entries:[2,4]}); the compat
// instance returns `[2, 4]` and `math.isResultSet(...)` is false. The one compat entry
// point most consumers use does not produce the documented shape. Pre-existing on main;
// recorded for exact parity.
// ---------------------------------------------------------------------------
describe('F3 compat evaluate: multi-statement block returns a ResultSet like mathjs', () => {
  it('math.isResultSet(math.evaluate("1+1\\n2+2")) is true, as in mathjs', () => {
    expect(compat().isResultSet(compat().evaluate('1+1\n2+2'))).toBe(
      oracle.isResultSet(oracle.evaluate('1+1\n2+2'))
    );
  });

  it('the block value has the mathjs ResultSet JSON shape', () => {
    const json = (v: unknown): unknown =>
      v !== null && typeof v === 'object' && 'toJSON' in (v as object)
        ? (v as { toJSON(): unknown }).toJSON()
        : v;
    expect(json(compat().evaluate('1+1\n2+2'))).toEqual(json(oracle.evaluate('1+1\n2+2')));
  });

  it('the block value is an instance of the instance ResultSet, as in mathjs', () => {
    const m = compat();
    expect(m.evaluate('1+1\n2+2') instanceof m.ResultSet).toBe(
      oracle.evaluate('1+1\n2+2') instanceof oracle.ResultSet
    );
  });

  it('matrix row separators must not be wrapped as a ResultSet (#993)', () => {
    const m = compat();
    const expr = '[1,2;3,4]*[1;1]';
    expect(m.isResultSet(m.evaluate(expr))).toBe(oracle.isResultSet(oracle.evaluate(expr)));
  });

  it('evaluate("1; 2") is a ResultSet of [2], as in mathjs (semicolon, one visible)', () => {
    const m = compat();
    const ours = m.evaluate('1; 2');
    const theirs = oracle.evaluate('1; 2');
    expect(m.isResultSet(ours)).toBe(oracle.isResultSet(theirs));
    expect(ours instanceof m.ResultSet).toBe(theirs instanceof oracle.ResultSet);
    expect((ours as { entries: unknown[] }).entries).toEqual(
      (theirs as { entries: unknown[] }).entries
    );
  });
});

// ---------------------------------------------------------------------------
// F4 (LOW) — compat's module-level `DimensionError` is not the same identity as the
// instance's `math.DimensionError`. mathjs exports one class and every instance shares
// it (`mathjs.DimensionError === create(all).DimensionError`). A consumer that does
// `err instanceof compat.DimensionError` against the module export misses an error the
// instance threw. Pre-existing on main; recorded for exact-parity completeness.
// ---------------------------------------------------------------------------
describe('F4 compat DimensionError: module export is the instance class, as in mathjs', () => {
  it('compat.DimensionError === create(all).DimensionError, as in mathjs', async () => {
    const mod = await import('../../src/index.js');
    const mathjsMod = (await import('mathjs')) as unknown as OracleRuntime;
    const mathjsSharesModuleClass = mathjsMod.DimensionError === oracle.DimensionError;
    expect(mathjsSharesModuleClass).toBe(true);
    expect(mod.DimensionError === createCompat(compatAll).DimensionError).toBe(
      mathjsSharesModuleClass
    );
  });
});

// ---------------------------------------------------------------------------
// F5 (LOW) — the compat `docs` map is not byte-identical to mathjs 15.3.0 for all 308
// keys: 56 entries differ. mathjs has no `name`/`category`/`syntax`/`seealso` keys on
// the physical-constant entries, and 6 entries carry different text (num, den, concat,
// multinomial, quantileSeq, coulomb). The policy is exact parity, so the compat map must
// be the mathjs map. (G12 exported the same enriched expression `docs` object on the
// typed package; compat's map is a filtered view of it, pre-existing on main.)
// ---------------------------------------------------------------------------
describe('F5 compat docs map is exactly the mathjs 15.3.0 map', () => {
  it('every mathjs docs key has the identical entry in compat.docs', async () => {
    const mod = await import('../../src/index.js');
    const mathjsMod = (await import('mathjs')) as unknown as OracleRuntime;
    const theirs = mathjsMod.docs;
    const ours = mod.docs as Record<string, unknown>;
    const mismatches = Object.keys(theirs).filter(
      (k) => JSON.stringify(ours[k]) !== JSON.stringify(theirs[k])
    );
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Native isolation: creating a compat instance must not change typed-package
// results (Daniel: critical libraries never change to match mathjs; quirks live
// in compat adapters only).
// ---------------------------------------------------------------------------
describe('creating a compat instance leaves native typed results unchanged', () => {
  it('functions.add of mismatched vectors is still RangeError after create(all)', async () => {
    const { add } = await import('@danielsimonjr/mathts-functions');
    const before = throwsWith(() => add([1, 2], [1, 2, 3] as unknown as number[]));
    createCompat(compatAll);
    const after = throwsWith(() => add([1, 2], [1, 2, 3] as unknown as number[]));
    expect(after).toEqual(before);
    expect(after.name).toBe('RangeError');
  });
});
