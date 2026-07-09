import { describe, it, expect } from 'vitest';
import { toTeX } from '../src/tex.js';
import type { RenderDoc } from '../src/html.js';
import { parse } from '@danielsimonjr/mathts-functions';

const doc = (cells: RenderDoc['cells'], title?: string): RenderDoc => ({ title, cells });

describe('toTeX', () => {
  it('standalone: preamble + document + maketitle', () => {
    const out = toTeX(doc([{ type: 'markdown', content: 'Hello **world**' }], 'My Notebook'), {
      parse,
    });
    expect(out).toContain('\\documentclass{article}');
    expect(out).toContain('\\usepackage{tikz}');
    expect(out).toContain('\\title{My Notebook}');
    expect(out).toContain('\\begin{document}');
    expect(out).toContain('\\maketitle');
    expect(out).toContain('\\textbf{world}');
    expect(out.trimEnd().endsWith('\\end{document}')).toBe(true);
  });
  it('fragment: no preamble/documentclass', () => {
    const out = toTeX(doc([{ type: 'markdown', content: 'x' }]), { parse, fragment: true });
    expect(out).not.toContain('\\documentclass');
    expect(out).not.toContain('\\begin{document}');
  });
  it('equation → \\[ .toTex() \\]', () => {
    const out = toTeX(doc([{ type: 'equation', content: 'sin(x)^2' }]), { parse });
    expect(out).toContain('\\[');
    expect(out).toContain('\\sin'); // from expression .toTex()
    expect(out).toContain('\\]');
  });
  it('equation parse failure → \\texttt{} text-mode fallback, no throw', () => {
    const throwingParse = () => {
      throw new Error('bad');
    };
    const out = toTeX(doc([{ type: 'equation', content: 'a %% b' }]), { parse: throwingParse });
    expect(out).toContain('\\texttt{');
    expect(out).not.toContain('\\[');
    expect(() =>
      toTeX(doc([{ type: 'equation', content: ')(' }]), { parse: throwingParse })
    ).not.toThrow();
  });
  it('equation with no parser → \\texttt{} text-mode fallback', () => {
    const out = toTeX(doc([{ type: 'equation', content: 'x + 1' }]), {});
    expect(out).toContain('\\texttt{');
    expect(out).not.toContain('\\[');
  });
  it('equation with working parser → \\[ .toTex() \\] unchanged', () => {
    const out = toTeX(doc([{ type: 'equation', content: 'x^2' }]), {
      parse: () => ({ toTex: () => 'x^2' }),
    });
    expect(out).toContain('\\[ x^2 \\]');
  });
  it('equation parse failure with math-special chars → no math-mode text macro', () => {
    const throwingParse = () => {
      throw new Error('bad');
    };
    const out = toTeX(doc([{ type: 'equation', content: 'a^b~c' }]), { parse: throwingParse });
    expect(out).not.toContain('\\['); // no display-math block to leak text-mode escapes into
    expect(out).toContain('\\textasciicircum{}');
    expect(out).toContain('\\textasciitilde{}');
  });
  it('code → lstlisting, output → verbatim, error → red', () => {
    const ok = toTeX(doc([{ type: 'code', content: 'a := 1', output: '1' }]));
    expect(ok).toContain('\\begin{lstlisting}');
    expect(ok).toContain('\\begin{verbatim}');
    const err = toTeX(doc([{ type: 'code', content: 'boom', error: 'kaboom' }]));
    expect(err).toContain('\\textcolor{red}');
  });
  it('test → colored PASS/FAIL/ERROR line', () => {
    expect(toTeX(doc([{ type: 'test', content: 't', passed: true }]))).toContain(
      '\\textcolor{green!60!black}{[PASS]}'
    );
    expect(toTeX(doc([{ type: 'test', content: 't', passed: false }]))).toContain(
      '\\textcolor{red}{[FAIL]}'
    );
    expect(toTeX(doc([{ type: 'test', content: 't', error: 'e' }]))).toContain('[ERROR]');
  });
  it('chart → embeds chartTikz in a center env', () => {
    const out = toTeX(
      doc([{ type: 'chart', content: '', chartTikz: '\\begin{tikzpicture}\\end{tikzpicture}' }])
    );
    expect(out).toContain('\\begin{center}');
    expect(out).toContain('\\begin{tikzpicture}');
  });
  it('escapes specials in prose/data', () => {
    expect(toTeX(doc([{ type: 'data', content: '', output: '50% & $x' }]))).toContain(
      '\\begin{verbatim}'
    );
    expect(toTeX(doc([{ type: 'markdown', content: 'cost 50%' }]))).toContain('50\\%');
  });
});
