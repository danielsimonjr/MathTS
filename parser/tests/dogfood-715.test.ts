import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, createParse } from '../src/index.js';

/** Issue #715 — createParse() needs factories; `parse` works from the package entry. */
describe('#715 mathts-parser standalone parse', () => {
  it('parse("2+2") without createParse bootstrap', () => {
    expect(() => parse('2+2')).not.toThrow();
    const node = parse('2+2');
    expect(node).toBeDefined();
    expect((node as { isOperatorNode?: boolean }).isOperatorNode).toBe(true);
  });

  it('createParse stays a factory', () => {
    expect(createParse.length).toBeGreaterThan(0);
  });

  it('oversized numeric literals throw Numeric overflow', () => {
    expect(() => parse('1e309')).toThrow(SyntaxError);
    expect(() => parse('1e309')).toThrow(/Numeric overflow/);
    expect(() => parse('9'.repeat(400))).toThrow(/Numeric overflow/);
    expect(() => parse('2e308')).toThrow(/Numeric overflow/);
    expect(() => parse('1e308')).not.toThrow();
  });

  it('README shows ready-to-call parse and the arithmetic sandbox', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(readme).toContain("from '@danielsimonjr/mathts-parser'");
    expect(readme).toContain("parse('2 + 3')");
    expect(readme).toContain('unsafe: true');
    expect(readme).toContain('does not import');
  });
});
