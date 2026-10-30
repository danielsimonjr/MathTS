import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parse } from '../helpers/wired-parse.js';
import { compile } from '../../src/compiler/compile.js';
import { MAX_PARSE_NESTING } from '../../src/limits.js';
import type { MathNode } from '../../src/node/Node.js';

const FC = { seed: 0x5eed, numRuns: 200 } as const;

const emptyCompileScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
};

function protoNamesSnapshot(): string {
  return JSON.stringify(Object.getOwnPropertyNames(Object.prototype));
}

function assertPrototypeUntouched(before: string): void {
  expect(JSON.stringify(Object.getOwnPropertyNames(Object.prototype))).toBe(before);
  expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
}

function parseOutcome(input: string): 'ok' | 'throw' {
  try {
    parse(input);
    return 'ok';
  } catch (e) {
    if (e instanceof RangeError) throw e;
    if (e instanceof SyntaxError || e instanceof Error) return 'throw';
    throw e;
  }
}

function countNodes(node: unknown): number {
  let count = 0;
  walkNodes(node, () => {
    count += 1;
  });
  return count;
}

function walkNodes(node: unknown, visit: (n: Record<string, unknown>) => void): void {
  if (typeof node !== 'object' || node === null) return;
  const n = node as Record<string, unknown>;
  if (n.isNode === true || (typeof n.type === 'string' && n.type.endsWith('Node'))) {
    visit(n);
  }
  for (const v of Object.values(n)) {
    if (Array.isArray(v)) {
      for (const item of v) walkNodes(item, visit);
    } else {
      walkNodes(v, visit);
    }
  }
}

const ARITHMETIC_ONLY = new Set(['ConstantNode', 'OperatorNode', 'ParenthesisNode']);

function isArithmeticAst(node: unknown): boolean {
  let ok = true;
  walkNodes(node, (n) => {
    const t = n.type as string;
    if (t === 'AssignmentNode' || t === 'FunctionAssignmentNode') ok = false;
    else if (!ARITHMETIC_ONLY.has(t)) ok = false;
  });
  return ok;
}

function tryCompileArithmetic(node: unknown): void {
  if (!isArithmeticAst(node)) return;
  if (countNodes(node) > 30) return;
  try {
    compile(node as MathNode, emptyCompileScope).evaluate();
  } catch (e) {
    if (e instanceof RangeError) throw e;
    if (!(e instanceof Error)) throw e;
  }
}

function fuzzParse(input: string): void {
  const protoBefore = protoNamesSnapshot();
  const outcome = parseOutcome(input);
  assertPrototypeUntouched(protoBefore);
  if (outcome === 'ok') {
    const node = parse(input);
    tryCompileArithmetic(node);
    assertPrototypeUntouched(protoBefore);
  }
}

describe('parse fuzz helpers are not vacuous', () => {
  it('walks real nodes, classifies arithmetic, and compiles it to a value', () => {
    const node = parse('1 + 2 * 3');
    expect(countNodes(node)).toBeGreaterThanOrEqual(5);
    expect(isArithmeticAst(node)).toBe(true);
    expect(compile(node as MathNode, emptyCompileScope).evaluate()).toBe(7);
  });

  it('refuses to classify symbols, calls, and assignments as arithmetic', () => {
    for (const text of ['x + 1', 'f(1)', 'a = 1']) {
      expect(isArithmeticAst(parse(text))).toBe(false);
    }
  });

  it('the nesting boundary is exact: below the cap parses, at the cap is a SyntaxError', () => {
    const wrap = (k: number) => '('.repeat(k) + '1' + ')'.repeat(k);
    expect(() => parse(wrap(MAX_PARSE_NESTING - 1))).not.toThrow();
    expect(() => parse(wrap(MAX_PARSE_NESTING))).toThrow(SyntaxError);
  });
});

describe('parse fuzz (security)', () => {
  it('arbitrary UTF-16 strings: parse ok or throws SyntaxError/Error, never RangeError', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (input) => {
        fuzzParse(input);
      }),
      FC
    );
  });

  it('token soup: parse ok or throws, prototype untouched', () => {
    const alphabet = '0123456789.+-*/^(),[]{}eE ';
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(...alphabet.split('')), { maxLength: 120 })
          .map((chars) => chars.join('')),
        (input) => {
          fuzzParse(input);
        }
      ),
      FC
    );
  });

  it('parenthesis nesting k=0..MAX_PARSE_NESTING does not throw RangeError or pollute', () => {
    for (let k = 0; k <= MAX_PARSE_NESTING; k++) {
      const input = '('.repeat(k) + '1' + ')'.repeat(k);
      const protoBefore = protoNamesSnapshot();
      try {
        parse(input);
      } catch (e) {
        expect(e).not.toBeInstanceOf(RangeError);
        if (!(e instanceof SyntaxError) && !(e instanceof Error)) throw e;
      }
      assertPrototypeUntouched(protoBefore);
    }
  });
});
