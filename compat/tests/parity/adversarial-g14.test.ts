/**
 * Adversarial probes for G14 (#1577 unit names in `toTex`, #1578 boolean-operator `toTex`
 * spacing) on PR #1730, head `bd49b098`.
 *
 * METHOD. Every expected value below is the live mathjs 15.3.0 oracle (`create(all)` from the
 * `mathjs` devDependency of this package), read at test time, not typed by hand. The broad
 * sweeps compare the compat instance against the oracle one expression at a time and collect
 * the mismatches, so a failure prints the exact expression and both renderings.
 *
 * WHAT THE BUILDER GOT WRONG (see the PR report for the severity ranking):
 *
 *  1. #1577 is implemented by (a) deleting the `typeof math[name] === 'undefined'` guard in
 *     `SymbolNode._toTex` and (b) consulting whatever `Unit` the scope carries. Native `core`'s
 *     unit table is a 338-name SUPERSET of mathjs's 251, so compat now renders an ordinary
 *     algebra variable `c` (core: speed of light), `d` (day), `u` (atomic mass unit), `G`
 *     (gauss), `M` (molar) and `P` (poise) as `\mathrm{…}` where mathjs prints ` c`. 90 base
 *     names over-render; `a/(b/c)` is the user-visible symptom.
 *  2. Removing the guard also over-renders the three mathjs functions that are ALSO valueless
 *     units — `min`, `sec`, `chain` — plus `coulomb` (an instance object). mathjs suppresses
 *     the `\mathrm{}` precisely because `typeof math[name] !== 'undefined'`; compat does not.
 *  3. Three names go the other way: `ton`, `tons` and `Ah` are valueless units in mathjs (so
 *     mathjs prints `\mathrm{ton}`) but are missing from native `core`'s table, so compat
 *     prints `2~ ton`.
 *  4. #1578 is implemented in NATIVE `expression` (`OperatorNode._toTex`), which rewrote the
 *     native expectations in three test files. Under the Nov 25 policy a cosmetic mathjs
 *     quirk must not change native output: main prints `\neg true`, the head prints `\negtrue`.
 *
 * Each `it` is a real failing test on `bd49b098`; none is skipped.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { parse as nativeParse } from '@danielsimonjr/mathts-expression';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';

type Instance = ReturnType<typeof createCompat> & ReturnType<typeof create>;

const oracle = create(all) as unknown as Instance;
const compat = (): Instance => createCompat(compatAll) as unknown as Instance;

/** `parse(expr).toTex(options)` on either instance; a throw is rendered, not swallowed. */
function tex(lib: Instance, expr: string, options?: Record<string, unknown>): string {
  try {
    return lib.parse(expr).toTex(options as never) as string;
  } catch (error) {
    return `THROW ${(error as Error).name}: ${(error as Error).message}`;
  }
}

/**
 * Compare compat with the oracle over a list of expressions and return the mismatches as
 * `expr => mathjs | compat`. An empty array is a pass; the diff list is the failure message.
 */
function mismatches(expressions: readonly string[], options?: Record<string, unknown>): string[] {
  const c = compat();
  const out: string[] = [];
  for (const expr of expressions) {
    const want = tex(oracle, expr, options);
    const got = tex(c, expr, options);
    if (want !== got)
      out.push(`${expr} => mathjs ${JSON.stringify(want)} compat ${JSON.stringify(got)}`);
  }
  return out;
}

const PREFIXES = Object.keys(oracle.Unit.PREFIXES.SHORT) as string[];
const UNIT_NAMES = Object.keys(oracle.Unit.UNITS) as string[];

// ---------------------------------------------------------------------------
// #1577: unit names in toTex
// ---------------------------------------------------------------------------

describe('G14 #1577: every mathjs unit name, bare and under every SI prefix', () => {
  it('renders each of the 251 mathjs unit names exactly as mathjs does', () => {
    // Bare names are the smallest probe: `2 cm` isolates the `\mathrm{}` decision from the
    // implicit-multiplication and parenthesization rules.
    expect(mismatches(UNIT_NAMES.map((n) => `2 ${n}`))).toEqual([]);
  });

  it('renders every prefix x unit combination exactly as mathjs does', () => {
    // mathjs's own unit table crossed with its own 25 short prefixes: 6,275 expressions.
    const expressions: string[] = [];
    for (const unit of UNIT_NAMES)
      for (const prefix of PREFIXES) expressions.push(`2 ${prefix}${unit}`);
    expect(mismatches(expressions)).toEqual([]);
  });

  it('renders the three aliases native core is missing (ton, tons, Ah) as \\mathrm', () => {
    // mathjs's `Unit.isValuelessUnit('ton')` is true (it is the metric tonne alias tree);
    // native core has no `ton`, so compat falls back to a plain symbol.
    expect(tex(compat(), '2 ton')).toBe(tex(oracle, '2 ton'));
    expect(tex(compat(), '2 tons')).toBe(tex(oracle, '2 tons'));
    expect(tex(compat(), '2 Ah')).toBe(tex(oracle, '2 Ah'));
  });

  it('does not render the 90 native-core-only unit names as \\mathrm', () => {
    // `core`'s table carries 338 names; mathjs's carries 251. The 90-odd extra entries
    // (`c`, `d`, `u`, `G`, `M`, `P`, `Bq`, `Gy`, `Sv`, `kat`, `sr`, `cal`, `percent`, `ppm`,
    // `dB`, `lm`, `lx`, `ly`, `pc`, `au`, `Å`, `Ω`, …) must NOT become units in `toTex`,
    // because mathjs prints them as plain symbols.
    /** Native core carries a wider table than mathjs; compat `Unit.UNITS` is already pinned. */
    const coreOnly = (Object.keys(factory_mathjsCompat.constructors.Unit.UNITS) as string[]).filter(
      (n) => !UNIT_NAMES.includes(n)
    );
    expect(coreOnly.length).toBeGreaterThan(50);
    expect(mismatches(coreOnly.map((n) => `2 ${n}`))).toEqual([]);
  });

  it('renders deg as ^\\circ and every other unit as \\mathrm, bare and prefixed', () => {
    expect(tex(compat(), 'deg')).toBe(tex(oracle, 'deg'));
    expect(tex(compat(), '2 deg')).toBe(tex(oracle, '2 deg'));
    expect(tex(compat(), 'degree')).toBe(tex(oracle, 'degree'));
    expect(tex(compat(), '2 degrees')).toBe(tex(oracle, '2 degrees'));
  });
});

describe('G14 #1577: names that collide with instance functions or constants', () => {
  // mathjs's rule is `typeof math[name] === 'undefined' && Unit.isValuelessUnit(name)`. The
  // builder deleted the first half, so every one of these regresses from a plain symbol to
  // `\mathrm{…}`.
  const COLLISIONS = [
    // mathjs instance functions that are also valueless units
    'min',
    'sec',
    'chain',
    // an instance object (coulomb constant) that is also a valueless unit
    'coulomb',
    // native-only instance functions that are also valueless units in core
    'degree',
    'newton',
    // ordinary function names that core happens to also list as units
    'abs',
    'sum',
    'max',
    'mod',
    'gcd',
    'log',
    'norm',
    'range',
    'mean',
    'median',
    'std',
    'var',
    'count',
    'sort',
    'map',
    'filter',
    'cross',
    'dot',
    'size',
    'zeros',
    'ones',
    'identity',
    'matrix',
    'transpose',
    'subset',
    'index',
  ];

  it('treats no instance function name as a unit (mathjs suppresses it)', () => {
    expect(mismatches(COLLISIONS.map((n) => `2 ${n}`))).toEqual([]);
  });

  it('keeps 2 min, 2 sec and 2 chain as plain symbols, as the oracle does', () => {
    for (const expr of ['2 min', '2 sec', '2 chain', '2 coulomb']) {
      expect(tex(compat(), expr)).toBe(tex(oracle, expr));
    }
  });

  it('keeps the call forms min(2,3), sec(0.5) and chain(2,3) unchanged', () => {
    expect(mismatches(['min(2, 3)', 'sec(0.5)', 'chain(2, 3)', 'coulomb(1, 2)'])).toEqual([]);
  });

  it('keeps a function call and a bare unit of the same name distinct in one expression', () => {
    // `min(2,3) + 2 min`: the call prints `\min`, the bare name is a plain symbol ` min`.
    expect(mismatches(['min(2,3) + 2 min', '2 sec + sec(0)'])).toEqual([]);
  });

  it('treats no single letter of the alphabet as a unit unless mathjs does', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    expect(mismatches(letters.map((letter) => `2 ${letter}`))).toEqual([]);
  });
});

describe('G14 #1577: symbols shadowed by a scope', () => {
  it('evaluates a unit name from an explicit scope instead of the unit (values, not TeX)', () => {
    const c = compat();
    for (const [expr, scope] of [
      ['cm', { cm: 5 }],
      ['2 cm', { cm: 5 }],
      ['b', { b: 3 }],
      ['A', { A: 7 }],
      ['ton', { ton: 2 }],
    ] as const) {
      const want = oracle.evaluate(expr, scope) as unknown;
      const got = c.evaluate(expr, scope) as unknown;
      expect(oracle.typeOf(want), expr).toBe(c.typeOf(got));
      expect(oracle.format(want, { precision: 14 }), expr).toBe(c.format(got, { precision: 14 }));
    }
  });

  it('leaves a symbol whose name is shadowed by a new unit out of the \\mathrm decision', () => {
    // `import({qq: 5})` creates an instance symbol that is not a unit; it must print plain.
    const c = compat();
    c.import({ qq: 5 });
    expect(tex(c, '2 qq')).toBe(tex(oracle, '2 qq'));
  });
});

// ---------------------------------------------------------------------------
// #1577: units inside larger expressions
// ---------------------------------------------------------------------------

describe('G14 #1577: units inside larger expressions', () => {
  const EXPRESSIONS = [
    '2 cm * 3 s',
    '2 cm / 3 s',
    '(2 cm)^2',
    'sqrt(4 cm^2)',
    '2 cm + 3 cm',
    '2 cm - 3 cm',
    '2 cm to inch',
    '2 inch to cm',
    '2 cm < 3 inch',
    '2 cm == 2 cm',
    '2 cm > 0',
    'max(2 cm, 3 cm)',
    '2 cm ? 1 : 2',
    '[2 cm, 3 s]',
    '{a: 2 cm}',
    'f(2 cm)',
    '2 cm.seconds',
    '2 cm^-1',
    '2 / (2 cm)',
    '1 / (2 cm)',
    '(2 cm) * (3 s)',
    '2 * 3 cm',
    '2 cm 3 s',
    '2 cm 3',
    '2 cm/s',
    '2 cm/s^2',
    '9.81 m/s^2',
    '2.5 kg m/s^2',
    '-2 cm',
    '+2 cm',
    '2 cm!',
    '2! cm',
    '2 cm and true',
    'true and 2 cm',
  ];

  it('matches mathjs for units composed into arithmetic, arrays, objects and calls', () => {
    expect(mismatches(EXPRESSIONS)).toEqual([]);
  });

  it('does not render a core-only unit inside a larger expression either', () => {
    // The `a/(b/c)` case the issue tracker names: `c` is core's speed-of-light unit, but
    // mathjs prints a plain ` c`.
    expect(mismatches(['a/(b/c)', 'b + c', 'a*b*c', 'a+c', 'c-a', 'b*c', '(b+c)/a'])).toEqual([]);
  });

  it('matches mathjs in the ordinary-symbol expressions the builder rewrote', () => {
    expect(mismatches(['x + y', 'x - y', 'x / y', 'x ^ y', '(x/y)^z', 'x * y', '2 x'])).toEqual([]);
  });
});

describe('G14 #1577: implicit multiplication', () => {
  const EXPRESSIONS = [
    '2 cm',
    '2cm',
    '2 cm 3 s',
    '2x',
    '2 x',
    '2(3)',
    '2 (3)',
    '(2)(3)',
    '2 pi',
    '2 e',
    '2 i',
    '2 cm m',
    '2 m cm',
    '2 kg m',
    '2 cm^2 s',
    'x y z',
    '2 sqrt(4)',
    '2 sin(x)',
    '2 min 3 sec',
  ];

  it('matches mathjs with the default implicit: hide', () => {
    expect(mismatches(EXPRESSIONS)).toEqual([]);
  });

  it('matches mathjs with implicit: show', () => {
    expect(mismatches(EXPRESSIONS, { implicit: 'show' })).toEqual([]);
  });

  it('matches mathjs with implicit: hide spelled out', () => {
    expect(mismatches(EXPRESSIONS, { implicit: 'hide' })).toEqual([]);
  });
});

describe('G14 #1577: parenthesization', () => {
  const EXPRESSIONS = [
    '(2 cm)',
    '((2 cm))',
    '2 cm + (3 s)',
    '-(2 cm)',
    '(2 cm)^2',
    '(2 cm + 3 s) * 2',
    '2 * (2 cm + 3 s)',
    '2 cm / (3 s)',
    '(2 cm / 3 s)^2',
    'x * (y + z)',
    '(x + y) < z < w',
  ];

  for (const parenthesis of ['all', 'keep', 'auto'] as const) {
    it(`matches mathjs with parenthesis: ${parenthesis}`, () => {
      expect(mismatches(EXPRESSIONS, { parenthesis })).toEqual([]);
    });
  }

  it('matches mathjs with no options', () => {
    expect(mismatches(EXPRESSIONS)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// #1578: boolean-operator spacing
// ---------------------------------------------------------------------------

describe('G14 #1578: and / or / xor / not, nested and mixed', () => {
  const EXPRESSIONS = [
    'true and false',
    'true or false',
    'true xor false',
    'not true',
    'not false',
    'not null',
    '2*true',
    '5 mod true',
    'a and true',
    '2*3*true',
    'true and false or true',
    'true or false and true',
    'not (true and false)',
    '(true and false) xor true',
    'not (not true)',
    '(true and false) or (true xor true)',
    'true and (false or true)',
    'not true and false',
    'true xor false xor true',
    'true or false or true',
    'a and b or c',
    'a or b and c',
    '(a and b) or c',
    'a and (b or c)',
    'x < 1 and y > 2',
    'not (x < 1)',
    'true == true',
    'true and 1',
    '1 and true',
    'not 0',
    '2 xor 3',
    'true or false xor true',
    '(true)',
    '((true and false))',
    'x and y',
    'x or y',
    'x xor y',
    'not x',
    'not 1',
    'not a',
    '2 cm and true',
    'true and 2 cm',
  ];

  it('matches mathjs byte for byte on and/or/xor/not, including the no-space join', () => {
    expect(mismatches(EXPRESSIONS)).toEqual([]);
  });

  it('matches mathjs under parenthesis: all', () => {
    expect(mismatches(EXPRESSIONS, { parenthesis: 'all' })).toEqual([]);
  });

  it('writes no space between \\wedge and a boolean, as mathjs does', () => {
    // The three rows of #1578, spelled out so the intent is readable in a failure.
    expect(tex(compat(), 'true and false')).toBe('true\\wedgefalse');
    expect(tex(compat(), 'not true')).toBe('\\negtrue');
    expect(tex(compat(), 'true xor false')).toBe('true\\veebarfalse');
  });

  it('still writes a space when the right operand is a symbol (its own leading space)', () => {
    // The no-space join only applies to bare-letter constants. A symbol operand carries a
    // leading space of its own, so `a and b` is ` a\\wedge\\mathrm{b}` in mathjs.
    expect(mismatches(['a and b', 'a or b', 'a xor b', 'not a'])).toEqual([]);
  });
});

describe('G14 #1578: the native expression package must keep main behavior', () => {
  // POLICY (Daniel, Nov 25 12:08 PM CT): a mathjs cosmetic quirk must NOT change native
  // output. `\negtrue` is a mathjs quirk — it is even invalid TeX (one unknown command) —
  // and native main deliberately spaces it. The head rewrote three native test files to
  // accept `\negtrue`; this assertion pins main's behavior.
  it('native parse keeps the space that #1014 item 5 added', () => {
    expect(nativeParse('not true').toTex()).toBe('\\neg true');
    expect(nativeParse('not false').toTex()).toBe('\\neg false');
    expect(nativeParse('not null').toTex()).toBe('\\neg null');
  });

  it('native parse keeps the space after \\cdot and \\wedge before a boolean', () => {
    expect(nativeParse('2*true').toTex()).toBe('2\\cdot true');
    expect(nativeParse('a and true').toTex()).toContain('\\wedge true');
    expect(nativeParse('2*3*true').toTex()).toBe('2\\cdot3\\cdot true');
  });

  it('native parse keeps a symbol operand unchanged (no double space, no removed space)', () => {
    expect(nativeParse('not a').toTex()).toBe('\\neg a');
    expect(nativeParse('x and y').toTex()).toBe(' x\\wedge y');
    expect(nativeParse('x + y').toTex()).toBe(' x+ y');
  });
});

// ---------------------------------------------------------------------------
// #1577 in native `functions` — reported, not asserted (critical library, policy forbids)
// ---------------------------------------------------------------------------

describe('G14: the toTex handler option', () => {
  // mathjs calls `options.handler(node, options)` for every node, and a non-undefined return
  // replaces that node's TeX. The builder does not touch HandlerNode, but the sweep below
  // proves the unit decision does not leak through a handler that returns `undefined`.
  const symbolicHandler = (node: { type?: string; name?: string }): string | undefined =>
    node.type === 'SymbolNode' && node.name === 'cm' ? '<<CM>>' : undefined;
  const operatorHandler = (node: { type?: string; op?: string }): string | undefined =>
    node.type === 'OperatorNode' ? `<${node.op}>` : undefined;
  const constantHandler = (node: { type?: string; value?: unknown }): string | undefined =>
    node.type === 'ConstantNode' ? `C[${String(node.value)}]` : undefined;
  const rootHandler = (): string => 'ROOT';

  const EXPRESSIONS = [
    'x + y',
    '2 cm + b',
    'true and false',
    'not true',
    '2 cm',
    'x*y*z',
    '2 min',
    '2 sec',
    '[2 cm, 3 s]',
    '2 cm^2',
    '2 percent',
  ];

  for (const [label, handler] of Object.entries({
    symbolicHandler,
    operatorHandler,
    constantHandler,
    rootHandler,
  })) {
    it(`matches mathjs with ${label}`, () => {
      expect(mismatches(EXPRESSIONS, { handler })).toEqual([]);
    });
  }

  it('a handler that replaces a unit symbol still sees the raw name', () => {
    expect(tex(compat(), '2 cm', { handler: symbolicHandler })).toBe(
      tex(oracle, '2 cm', { handler: symbolicHandler })
    );
  });
});

describe('G14: creating a compat instance must not mutate native', () => {
  it('does not change native expression toTex after create(all)', () => {
    const beforeNot = nativeParse('not true').toTex();
    const beforeCm = nativeParse('2 cm').toTex();
    const beforeAnd = nativeParse('true and false').toTex();
    createCompat(compatAll);
    expect(nativeParse('not true').toTex()).toBe(beforeNot);
    expect(nativeParse('2 cm').toTex()).toBe(beforeCm);
    expect(nativeParse('true and false').toTex()).toBe(beforeAnd);
    expect(beforeNot).toBe('\\neg true');
    expect(beforeAnd).toBe('true\\wedge false');
  });

  it('does not rewrite native Unit.UNITS or isValuelessUnit', () => {
    const NativeUnit = factory_mathjsCompat.constructors.Unit;
    const keysBefore = Object.keys(NativeUnit.UNITS).sort();
    const cBefore = NativeUnit.isValuelessUnit('c');
    const tonBefore = NativeUnit.isValuelessUnit('ton');
    const math = createCompat(compatAll);
    expect(Object.keys(NativeUnit.UNITS).sort()).toEqual(keysBefore);
    expect(NativeUnit.isValuelessUnit('c')).toBe(cBefore);
    expect(NativeUnit.isValuelessUnit('ton')).toBe(tonBefore);
    expect(math.Unit).not.toBe(NativeUnit);
    expect(math.Unit.isValuelessUnit('c')).toBe(false);
    expect(NativeUnit.isValuelessUnit('c')).toBe(true);
  });
});

describe('G14: the unit table itself must match mathjs', () => {
  it('exposes exactly the unit names mathjs exposes', () => {
    // Root cause of the over-render: compat inherits core's 338-name table. `toTex` cannot
    // match mathjs while the table is a superset.
    const compatUnits = (Object.keys(compat().Unit.UNITS) as string[]).sort();
    const oracleUnits = [...UNIT_NAMES].sort();
    expect(compatUnits).toEqual(oracleUnits);
  });

  it('agrees with mathjs on isValuelessUnit for every name either side knows', () => {
    const c = compat();
    const names = new Set([...UNIT_NAMES, ...(Object.keys(c.Unit.UNITS) as string[])]);
    const disagreements: string[] = [];
    for (const name of names) {
      const want = oracle.Unit.isValuelessUnit(name);
      const got = c.Unit.isValuelessUnit(name);
      if (want !== got) disagreements.push(`${name}: mathjs ${want} compat ${got}`);
    }
    expect(disagreements).toEqual([]);
  });
});
