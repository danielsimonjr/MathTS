import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';

describe('Node.toMarkdown', () => {
  it('wraps toTex in display math by default', () => {
    const node = parse('x^2 + 1');
    expect(node.toMarkdown()).toBe('$$\n' + node.toTex() + '\n$$');
  });
  it('wraps toTex in inline math when inline:true', () => {
    const node = parse('x^2 + 1');
    expect(node.toMarkdown({ inline: true })).toBe('$' + node.toTex() + '$');
  });
  it('passes StringOptions through to toTex', () => {
    const node = parse('a/b');
    const opts = { parenthesis: 'all' as const };
    expect(node.toMarkdown(opts)).toBe('$$\n' + node.toTex(opts) + '\n$$');
  });
});
