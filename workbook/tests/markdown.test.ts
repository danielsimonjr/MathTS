import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../src/markdown.js';

describe('markdownToHtml', () => {
  it('renders ATX headings', () => {
    expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(markdownToHtml('### Sub')).toContain('<h3>Sub</h3>');
  });

  it('renders paragraphs with inline bold/italic/code', () => {
    const out = markdownToHtml('A **bold** and *italic* and `code` here.');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
    expect(out).toContain('<code>code</code>');
    expect(out).toContain('<p>');
  });

  it('renders fenced code blocks (escaped, not interpreted)', () => {
    const out = markdownToHtml('```\nlet x = a < b;\n```');
    expect(out).toContain('<pre><code>');
    expect(out).toContain('a &lt; b');
  });

  it('renders unordered and ordered lists', () => {
    expect(markdownToHtml('- one\n- two')).toMatch(/<ul><li>one<\/li><li>two<\/li><\/ul>/);
    expect(markdownToHtml('1. a\n2. b')).toMatch(/<ol><li>a<\/li><li>b<\/li><\/ol>/);
  });

  it('renders a horizontal rule and allowlisted links', () => {
    expect(markdownToHtml('---')).toContain('<hr');
    expect(markdownToHtml('[site](https://example.com)')).toContain(
      '<a href="https://example.com">site</a>'
    );
    expect(markdownToHtml('[rel](./page.html)')).toContain('<a href="./page.html">rel</a>');
    expect(markdownToHtml('[anchor](#sec)')).toContain('<a href="#sec">anchor</a>');
  });

  it('drops dangerous link protocols (renders text only)', () => {
    for (const bad of [
      '[x](javascript:alert(1))',
      '[x](JAVASCRIPT:alert(1))',
      '[x](data:text/html,<script>)',
      '[x](vbscript:msgbox)',
      '[x](//evil.com)',
      '[x](j\na\r\nv\ta\bs\fc\0r\u0000i\u000bp\ft:alert(1))',
      '[x](java\x09script:alert(1))',
      '[x](\x01javascript:alert(1))',
      '[x]( javascript:alert(1))',
    ]) {
      const out = markdownToHtml(bad);
      expect(out).not.toContain('<a href');
      expect(out).toContain('x');
    }
  });

  it('escapes raw HTML (XSS-safe)', () => {
    const out = markdownToHtml('<script>alert(1)</script> & <b>x</b>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
  });

  it('never throws on odd input', () => {
    expect(() => markdownToHtml('** *`[](')).not.toThrow();
    expect(markdownToHtml('')).toBe('');
  });
});
