import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { embeddedDocs } from '@danielsimonjr/mathts-expression';

describe('#1776 help() embedded documentation', () => {
  const math = create(all);

  it('resolves documentation from a constant value (math.pi)', () => {
    const help = math.help(math.pi) as { doc: { name: string } };
    expect(help.doc.name).toBe('pi');
  });

  it('rejects unsafe embedded-doc property names', () => {
    expect(() => math.help('constructor')).toThrow(/No access/);
  });

  it('throws TypeError for wrong arity', () => {
    expect(() => (math.help as () => unknown)()).toThrow(/Too few arguments/);
    expect(() => (math.help as (a: unknown, b: unknown) => unknown)('sin', 2)).toThrow(
      /Too many arguments/
    );
  });

  it('documents compatBlockResultSet and runs its examples', () => {
    const help = math.help('compatBlockResultSet') as {
      doc: { name: string; examples: string[] };
    };
    expect(help.doc.name).toBe('compatBlockResultSet');
    expect(help.doc.examples.length).toBeGreaterThan(0);
    expect(() => math.evaluate(help.doc.examples)).not.toThrow();
  });

  it('evaluates embedded example sequences with shared scope', () => {
    const examples = (embeddedDocs as { add: { examples: string[] } }).add.examples;
    const results = math.evaluate(examples, {}) as unknown[];
    expect(results).toHaveLength(examples.length);
    expect(results[results.length - 1]).toBeDefined();
  });

  it('evaluates nested evaluate([...]) doc example', () => {
    expect(() =>
      math.evaluate('evaluate(["width=2", "height=4","width*height"])', {})
    ).not.toThrow();
  });

  it('allows createUnit with { override: true } to update an already-registered custom unit', () => {
    const local = create(all);
    local.createUnit('auditBar', '1 m');
    expect(String(local.evaluate('1 auditBar to m'))).toBe('1 m');

    local.createUnit('auditBar', '2 m', { override: true });
    expect(String(local.evaluate('1 auditBar to m'))).toBe('2 m');

    local.createUnit({ auditBar: '3 m' }, { override: true });
    expect(String(local.evaluate('1 auditBar to m'))).toBe('3 m');
  });

  it('recognizes real parser instances via instanceof Parser and rejects duck-typed objects', () => {
    const fromFactory = math.parser();
    const fromCtor = new math.Parser();
    const duckTyped = {
      evaluate() {
        return 0;
      },
      get() {
        return undefined;
      },
      set() {},
      scope: {},
    };

    expect(fromFactory instanceof math.Parser).toBe(true);
    expect(fromCtor instanceof math.Parser).toBe(true);
    expect(duckTyped instanceof math.Parser).toBe(false);
  });
});
