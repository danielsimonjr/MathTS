import { describe, it, expect } from 'vitest';
import { markdownToTex, texEscape } from '../src/markdown.js';

describe('texEscape', () => {
  it('escapes LaTeX specials in a single pass (no double-escape of backslash)', () => {
    expect(texEscape('a_b % 50% & $x$ #1 {y}')).toBe('a\\_b \\% 50\\% \\& \\$x\\$ \\#1 \\{y\\}');
    expect(texEscape('a\\b')).toBe('a\\textbackslash{}b'); // not a\textbackslash\{\}b
    expect(texEscape('x^2 ~n')).toBe('x\\textasciicircum{}2 \\textasciitilde{}n');
  });
});

describe('markdownToTex', () => {
  it('headings map to sectioning', () => {
    expect(markdownToTex('# Title')).toContain('\\section*{Title}');
    expect(markdownToTex('## Sub')).toContain('\\subsection*{Sub}');
  });
  it('bold/italic/code inline', () => {
    const out = markdownToTex('**b** *i* `c`');
    expect(out).toContain('\\textbf{b}');
    expect(out).toContain('\\emph{i}');
    expect(out).toContain('\\texttt{c}');
  });
  it('fenced code → lstlisting (raw, not escaped)', () => {
    const out = markdownToTex('```\na_b := 1\n```');
    expect(out).toContain('\\begin{lstlisting}');
    expect(out).toContain('a_b := 1'); // raw inside listing
    expect(out).toContain('\\end{lstlisting}');
  });
  it('lists', () => {
    expect(markdownToTex('- one\n- two')).toContain('\\begin{itemize}');
    expect(markdownToTex('1. a\n2. b')).toContain('\\begin{enumerate}');
  });
  it('escapes specials in prose', () => {
    expect(markdownToTex('cost is 50% of $x')).toContain('50\\% of \\$x');
  });
  it('safe link → \\href; unsafe scheme dropped to text', () => {
    expect(markdownToTex('[go](https://example.com)')).toContain('\\href{https://example.com}{go}');
    const bad = markdownToTex('[x](javascript:alert(1))');
    expect(bad).not.toContain('javascript');
    expect(bad).toContain('x');
  });
});
