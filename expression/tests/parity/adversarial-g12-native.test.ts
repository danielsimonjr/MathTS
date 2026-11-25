import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import * as expression from '../../src/index.js';
import { isResultSet } from '../../src/utils/is.js';

/**
 * Adversarial probes for G12's native `expression` surface (#1567, #1571).
 *
 * These are NATIVE findings, not compat ones. Policy (Daniel, 2025-11-25, final):
 * native packages outside the critical libraries (expression, units, workbook, plot)
 * adopt a mathjs behavior only when it is a genuinely better idea; a mathjs quirk must
 * never change native output, and native test expectations must stay unchanged versus
 * main. The regressions below are ones G12 introduced on the native surface; each is a
 * real failing test on the PR head `0dd7ef6f`. Numbered as in the PR body.
 */

// ---------------------------------------------------------------------------
// F6 (HIGH) — G12 moved `ResultSet` out of `parse-defaults.ts` into a new exported class
// whose `isResultSet` flag is an INSTANCE field, but the package's own `isResultSet`
// guard (and functions' `resultSet` typed test) read the flag off the CONSTRUCTOR
// PROTOTYPE. Before G12 the private class had `get isResultSet()` on the prototype, so
// `isResultSet(blockResult)` was `true`. After G12 it is `false` for every block result
// and every `new ResultSet(...)`. This silently changes native behavior: a ResultSet no
// longer satisfies the package's own type guard, and the typed dispatch in functions
// (`{name:'ResultSet', test: isResultSet}`) stops recognizing it.
// ---------------------------------------------------------------------------
describe('F6 native expression: a ResultSet still satisfies the package isResultSet guard', () => {
  it('isResultSet(parse("1+1\\n2+2").compile().evaluate()) is true (was true before G12)', () => {
    const block = expression.parse('1+1\n2+2').compile().evaluate();
    expect(isResultSet(block)).toBe(true);
  });

  it('isResultSet(new ResultSet([1,2])) is true (was true before G12)', () => {
    const rs = new (
      expression as unknown as { ResultSet: new (e: unknown[]) => unknown }
    ).ResultSet([1, 2]);
    expect(isResultSet(rs)).toBe(true);
  });

  it('the guard flag lives on the prototype, the place isResultSet reads', () => {
    const ResultSet = (
      expression as unknown as { ResultSet: { prototype: { isResultSet?: true } } }
    ).ResultSet;
    expect(ResultSet.prototype.isResultSet).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F7 (HIGH) — the exported node classes are not the classes `parse()` builds. mathjs's
// `parse('2+x') instanceof OperatorNode` is true and each child is an instance of its
// exported class; the exported classes here are separate factory closures that share
// only the `Node` base, so every `instanceof` except `Node` is false. The whole point of
// exporting the classes (#1571) is `instanceof` — so the export is inert for native
// users, and a consumer's `node instanceof ConstantNode` is silently false.
// ---------------------------------------------------------------------------
describe('F7 native expression: parsed nodes are instances of the exported node classes', () => {
  it('parse("2+x") instanceof OperatorNode (mathjs: true)', () => {
    const p = expression.parse('2+x');
    expect(
      p instanceof
        (expression as unknown as { OperatorNode: new (...a: never[]) => object }).OperatorNode
    ).toBe(true);
  });

  it('parse("2.3") instanceof ConstantNode (mathjs: true)', () => {
    expect(
      expression.parse('2.3') instanceof
        (expression as unknown as { ConstantNode: new (...a: never[]) => object }).ConstantNode
    ).toBe(true);
  });

  it('the parse tree children are instances of their exported classes', () => {
    const tree = expression.parse('2+x') as unknown as { args: unknown[] };
    const ex = expression as unknown as {
      ConstantNode: new (...a: never[]) => object;
      SymbolNode: new (...a: never[]) => object;
    };
    expect(tree.args[0]).toBeInstanceOf(ex.ConstantNode);
    expect(tree.args[1]).toBeInstanceOf(ex.SymbolNode);
  });

  it('the exported class identity matches the one parse() uses, as in mathjs', () => {
    const p = expression.parse('2+x');
    const exported = (expression as unknown as { OperatorNode: new (...a: never[]) => object })
      .OperatorNode;
    // mathjs: parse('2+x').constructor === OperatorNode
    expect(p.constructor).toBe(exported);
  });
});

// ---------------------------------------------------------------------------
// F8 (MEDIUM) — `createParser()` returns a `Parser` instance that is not an instance of
// the exported `Parser` class. mathjs: `parser() instanceof Parser` is true, and the same
// `Parser` class serves both. Here `createParser()()` builds a second class, so the
// exported `Parser` and the factory's class diverge.
// ---------------------------------------------------------------------------
describe('F8 native expression: createParser() result is an instance of the exported Parser', () => {
  it('createParser()() instanceof Parser (mathjs: true)', () => {
    const Parser = (expression as unknown as { Parser: new (...a: never[]) => object }).Parser;
    const made = (expression as unknown as { createParser: () => () => unknown }).createParser()();
    expect(made).toBeInstanceOf(Parser);
  });
});

// ---------------------------------------------------------------------------
// F9 (INFO) — `ResultSet` puts `isResultSet` and `type` on every instance as own
// enumerable fields, where mathjs (and pre-G12 native) kept them on the prototype. It is
// a cosmetic shape difference for native (a spread/`Object.keys` of a block result now
// shows two extra keys), recorded because G12 introduced it. It is NOT requested above
// to match mathjs — it is flagged as a native shape change.
// ---------------------------------------------------------------------------
describe('F9 native expression: ResultSet own-key shape changed by G12', () => {
  it('a block result carries only "entries" as an own key (pre-G12 shape)', () => {
    const block = expression.parse('1+1\n2+2').compile().evaluate();
    expect(Object.keys(block as object)).toEqual(['entries']);
  });
});

// ---------------------------------------------------------------------------
// Sanity: the mathjs oracle agrees with every "mathjs: true/false" note above, so the
// expectations are grounded in the pinned version, not in a guess.
// ---------------------------------------------------------------------------
describe('mathjs 15.3.0 oracle confirms the native expectations', () => {
  it('mathjs parse nodes are instances of the exported classes', () => {
    const mj = mathjs as unknown as {
      Parser: new (...args: never[]) => object;
    };
    expect(mathjs.parse('2+x') instanceof mathjs.OperatorNode).toBe(true);
    expect(mathjs.parse('2.3') instanceof mathjs.ConstantNode).toBe(true);
    expect(mathjs.parser() instanceof mj.Parser).toBe(true);
    expect(mathjs.isResultSet(mathjs.parse('1+1\n2+2').compile().evaluate())).toBe(true);
  });
});
