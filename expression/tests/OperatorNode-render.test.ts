import { describe, it, expect } from 'vitest';
import type { MathNode } from '../src/node/Node.js';
import { parse, OperatorNode, ConstantNode, SymbolNode } from './helpers/bootstrap.js';

/**
 * Rendering / formatting coverage for OperatorNode.
 *
 * Exercises the `_toString`, `_toHTML`, `_toTex` and
 * `calculateNecessaryParentheses` branches via the real parser, plus
 * constructor validation, `_compile`, and structural helpers. Expected
 * strings were captured from the real wired parser and asserted exactly /
 * by meaningful substring.
 */

describe('OperatorNode - constructor & identity', () => {
  it('builds a binary node with correct fields', () => {
    const n = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(2)]);
    expect(n.op).toBe('+');
    expect(n.fn).toBe('add');
    expect(n.args).toHaveLength(2);
    expect(n.type).toBe('OperatorNode');
    expect(n.isOperatorNode).toBe(true);
    expect(n.implicit).toBe(false);
    expect(n.isPercentage).toBe(false);
    expect(n.getIdentifier()).toBe('OperatorNode:add');
  });

  it('isUnary / isBinary reflect arity', () => {
    expect(new OperatorNode('-', 'unaryMinus', [new ConstantNode(1)]).isUnary()).toBe(true);
    expect(new OperatorNode('-', 'unaryMinus', [new ConstantNode(1)]).isBinary()).toBe(false);
    const bin = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(2)]);
    expect(bin.isBinary()).toBe(true);
    expect(bin.isUnary()).toBe(false);
  });

  it('throws when op is not a string', () => {
    expect(() => new OperatorNode(1 as unknown as string, 'f', [])).toThrow(
      'string expected for parameter "op"'
    );
  });

  it('throws when fn is not a string', () => {
    expect(() => new OperatorNode('+', 1 as unknown as string, [])).toThrow(
      'string expected for parameter "fn"'
    );
  });

  it('throws when args contains non-Nodes', () => {
    expect(() => new OperatorNode('+', 'add', [1 as unknown as MathNode])).toThrow(
      'Array containing Nodes expected for parameter "args"'
    );
  });

  it('records the implicit and isPercentage flags', () => {
    const pct = new OperatorNode(
      '%',
      'mod',
      [new ConstantNode(10), new ConstantNode(3)],
      false,
      true
    );
    expect(pct.isPercentage).toBe(true);
    expect(pct.toJSON().isPercentage).toBe(true);
  });
});

describe('OperatorNode - _toString (unary)', () => {
  it('prefix operator: -a', () => {
    expect(parse('-a').toString()).toBe('-a');
  });

  it('named prefix operator: not a (space after named op)', () => {
    expect(parse('not a').toString()).toBe('not a');
  });

  it('postfix operator: 5! (left-associative)', () => {
    expect(parse('5!').toString()).toBe('5!');
  });
});

describe('OperatorNode - _toString (binary)', () => {
  it('add', () => {
    expect(parse('a + b').toString()).toBe('a + b');
  });
  it('subtract', () => {
    expect(parse('a - b').toString()).toBe('a - b');
  });
  it('divide', () => {
    expect(parse('a / b').toString()).toBe('a / b');
  });
  it('pow', () => {
    expect(parse('a ^ b').toString()).toBe('a ^ b');
  });
  it('multiply (explicit)', () => {
    expect(parse('a * b').toString()).toBe('a * b');
  });
  it('implicit multiply hides operator: 2 x', () => {
    const n = parse('2 x');
    expect(n.implicit).toBe(true);
    expect(n.toString()).toBe('2 x');
  });
  it('implicit multiply shown when implicit:show', () => {
    expect(parse('2 x').toString({ implicit: 'show' })).toBe('2 * x');
  });
});

describe('OperatorNode - _toString (n-ary add/multiply)', () => {
  it('n-ary add joins with +', () => {
    expect(parse('a + b + c').toString()).toBe('a + b + c');
  });
  it('n-ary multiply joins with *', () => {
    expect(parse('a * b * c').toString()).toBe('a * b * c');
  });
  it('n-ary add with parenthesis:all parenthesizes left chain', () => {
    expect(parse('a + b + c').toString({ parenthesis: 'all' })).toBe('(a + b) + c');
  });
  it('implicit n-ary multiply hides operators', () => {
    expect(parse('2 x y').toString()).toBe('2 x y');
  });
  it('implicit n-ary multiply shown when implicit:show', () => {
    expect(parse('2 x y').toString({ implicit: 'show' })).toBe('2 * x * y');
  });
  it('implicit constant edge: (2)(3) parenthesizes trailing constant', () => {
    expect(parse('(2)(3)').toString()).toBe('(2) (3)');
  });
});

describe('OperatorNode - _toString (parenthesis & precedence)', () => {
  it('keeps explicit parens: (a + b) * c', () => {
    expect(parse('(a + b) * c').toString()).toBe('(a + b) * c');
  });
  it('parenthesizes lower-precedence rhs: a * (b + c)', () => {
    expect(parse('a * (b + c)').toString()).toBe('a * (b + c)');
  });
  it('right-grouped subtract keeps parens: a - (b - c)', () => {
    expect(parse('a - (b - c)').toString()).toBe('a - (b - c)');
  });
  it('left-grouped subtract keeps explicit parens via input', () => {
    expect(parse('(a - b) - c').toString()).toBe('(a - b) - c');
  });
  it('chained divide: a / b / c', () => {
    expect(parse('a / b / c').toString()).toBe('a / b / c');
  });
  it('precedence without parens: 2 + 3 * 4', () => {
    expect(parse('2 + 3 * 4').toString()).toBe('2 + 3 * 4');
  });
  it('right-associative pow under parenthesis:all', () => {
    expect(parse('2 ^ 3 ^ 4').toString({ parenthesis: 'all' })).toBe('2 ^ (3 ^ 4)');
  });
  it('fallback to function-call form for non-add/multiply >2 args', () => {
    const n = new OperatorNode('@', 'customFn', [
      new ConstantNode(1),
      new ConstantNode(2),
      new ConstantNode(3),
    ]);
    expect(n.toString()).toBe('customFn(1, 2, 3)');
  });
});

describe('OperatorNode - _toTex', () => {
  it('unary prefix', () => {
    expect(parse('-a').toTex()).toBe('- a');
  });
  it('named unary uses latex op', () => {
    expect(parse('not a').toTex()).toBe('\\neg a');
  });
  it('postfix factorial', () => {
    expect(parse('5!').toTex()).toBe('5!');
  });
  it('add', () => {
    expect(parse('a + b').toTex()).toBe(' a+ b');
  });
  it('subtract', () => {
    expect(parse('a - b').toTex()).toBe(' a- b');
  });
  it('divide uses \\frac', () => {
    expect(parse('a / b').toTex()).toBe('\\frac{ a}{ b}');
  });
  it('pow uses braces', () => {
    expect(parse('a ^ b').toTex()).toBe('{ a}^{ b}');
  });
  it('divide inside pow gets \\left(\\right)', () => {
    expect(parse('(a/b)^c').toTex()).toBe('{\\left(\\frac{ a}{ b}\\right)}^{ c}');
  });
  it('conditional base inside pow gets \\left(\\right)', () => {
    const tex = parse('(a > 0 ? 1 : 2)^2').toTex();
    expect(tex).toContain('\\left(');
    expect(tex).toContain('\\begin{cases}');
    expect(tex).toContain('}^{2}');
  });
  it('multiply explicit uses \\cdot', () => {
    expect(parse('a * b').toTex()).toBe(' a\\cdot b');
  });
  it('implicit multiply uses ~', () => {
    expect(parse('2 x').toTex()).toBe('2~ x');
  });
  it('implicit multiply with implicit:show uses \\cdot', () => {
    expect(parse('2 x').toTex({ implicit: 'show' })).toBe('2\\cdot x');
  });
  it('n-ary add joins with +', () => {
    expect(parse('a + b + c').toTex()).toBe(' a+ b+ c');
  });
  it('n-ary multiply joins with \\cdot', () => {
    expect(parse('a * b * c').toTex()).toBe(' a\\cdot b\\cdot c');
  });
  it('n-ary implicit multiply joins with ~', () => {
    expect(parse('2 x y').toTex()).toBe('2~ x~ y');
  });
  it('n-ary add parenthesis:all wraps left chain', () => {
    expect(parse('a + b + c').toTex({ parenthesis: 'all' })).toBe('\\left( a+ b\\right)+ c');
  });
  it('lower-precedence rhs parenthesized: a * (b + c)', () => {
    expect(parse('a * (b + c)').toTex()).toBe(' a\\cdot\\left( b+ c\\right)');
  });
  it('right-associative pow under parenthesis:all', () => {
    expect(parse('2 ^ 3 ^ 4').toTex({ parenthesis: 'all' })).toBe('{2}^{\\left({3}^{4}\\right)}');
  });
  it('fallback to \\mathrm function form for non-add/multiply >2 args', () => {
    const n = new OperatorNode('@', 'customFn', [
      new ConstantNode(1),
      new ConstantNode(2),
      new ConstantNode(3),
    ]);
    expect(n.toTex()).toBe('\\mathrm{customFn}\\left(1,2,3\\right)');
  });
});

describe('OperatorNode - _toHTML', () => {
  it('unary prefix marks lefthand-unary-operator', () => {
    const html = parse('-a').toHTML();
    expect(html).toContain('math-lefthand-unary-operator');
    expect(html).toContain('>-<');
  });
  it('postfix marks righthand-unary-operator', () => {
    expect(parse('5!').toHTML()).toContain('math-righthand-unary-operator');
  });
  it('binary marks explicit-binary-operator', () => {
    const html = parse('a / b').toHTML();
    expect(html).toContain('math-explicit-binary-operator');
    expect(html).toContain('>/<');
  });
  it('implicit binary marks implicit-binary-operator', () => {
    expect(parse('2 x').toHTML()).toContain('math-implicit-binary-operator');
  });
  it('implicit binary with implicit:show marks explicit', () => {
    expect(parse('2 x').toHTML({ implicit: 'show' })).toContain('math-explicit-binary-operator');
  });
  it('nested adds round parenthesis spans', () => {
    const html = parse('a * (b + c)').toHTML();
    expect(html).toContain('math-round-parenthesis');
  });
  it('n-ary add joins with binary operator spans', () => {
    const html = parse('a + b + c').toHTML();
    expect(html).toMatch(/math-binary-operator/);
  });
  it('n-ary add parenthesis:all wraps in round parens', () => {
    expect(parse('a + b + c').toHTML({ parenthesis: 'all' })).toContain('math-round-parenthesis');
  });
  it('n-ary implicit multiply uses implicit operator spans', () => {
    expect(parse('2 x y').toHTML()).toContain('math-implicit-binary-operator');
  });
  it('fallback to math-function span for non-add/multiply >2 args', () => {
    const n = new OperatorNode('@', 'customFn', [
      new ConstantNode(1),
      new ConstantNode(2),
      new ConstantNode(3),
    ]);
    const html = n.toHTML();
    expect(html).toContain('math-function');
    expect(html).toContain('customFn');
    expect(html).toContain('math-separator');
  });
});

describe('OperatorNode - _compile / evaluate', () => {
  it('evaluates binary add', () => {
    expect(parse('2 + 3').compile().evaluate()).toBe(5);
  });
  it('evaluates unary minus', () => {
    expect(parse('-5').compile().evaluate()).toBe(-5);
  });
  it('evaluates n-ary add', () => {
    expect(parse('1 + 2 + 3').compile().evaluate()).toBe(6);
  });
  it('evaluates multiply and divide', () => {
    expect(parse('6 * 7').compile().evaluate()).toBe(42);
    expect(parse('20 / 4').compile().evaluate()).toBe(5);
  });
  it('throws when fn is missing in the math namespace', () => {
    const n = new OperatorNode('@@', 'noSuchFn123', [new ConstantNode(1), new ConstantNode(2)]);
    expect(() => n.compile()).toThrow(/missing in provided namespace|No access to function/);
  });
});

describe('OperatorNode - structural helpers', () => {
  it('forEach visits each arg with path', () => {
    const a = new ConstantNode(1);
    const b = new ConstantNode(2);
    const n = new OperatorNode('+', 'add', [a, b]);
    const seen: { child: MathNode; path: string }[] = [];
    n.forEach((child: MathNode, path: string) => seen.push({ child, path }));
    expect(seen).toHaveLength(2);
    expect(seen[0].child).toBe(a);
    expect(seen[0].path).toBe('args[0]');
    expect(seen[1].path).toBe('args[1]');
  });

  it('map returns a new OperatorNode with transformed args', () => {
    const n = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(2)]);
    const replacement = new ConstantNode(99);
    const mapped = n.map((child: MathNode, path: string) =>
      path === 'args[0]' ? replacement : child
    );
    expect(mapped).not.toBe(n);
    expect(mapped.isOperatorNode).toBe(true);
    expect(mapped.args[0]).toBe(replacement);
    expect(mapped.op).toBe('+');
    expect(mapped.fn).toBe('add');
  });

  it('clone makes a shallow copy preserving flags', () => {
    const n = new OperatorNode(
      '*',
      'multiply',
      [new SymbolNode('x'), new ConstantNode(2)],
      true,
      false
    );
    const c = n.clone();
    expect(c).not.toBe(n);
    expect(c.op).toBe('*');
    expect(c.fn).toBe('multiply');
    expect(c.implicit).toBe(true);
    expect(c.args).not.toBe(n.args);
    expect(c.args[0]).toBe(n.args[0]);
  });

  it('toJSON / fromJSON roundtrip', () => {
    const n = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(2)]);
    const json = n.toJSON();
    expect(json.mathjs).toBe('OperatorNode');
    expect(json.op).toBe('+');
    expect(json.fn).toBe('add');
    const restored = OperatorNode.fromJSON({
      op: json.op,
      fn: json.fn,
      args: n.args,
      implicit: false,
      isPercentage: false,
    });
    expect(restored.isOperatorNode).toBe(true);
    expect(restored.getIdentifier()).toBe('OperatorNode:add');
  });

  it('equals compares structurally', () => {
    const a = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(2)]);
    const b = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(2)]);
    const c = new OperatorNode('+', 'add', [new ConstantNode(1), new ConstantNode(3)]);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(null)).toBe(false);
  });
});
