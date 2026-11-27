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
});
