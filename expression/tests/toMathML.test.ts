import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';
import { mathMLDocument, mathMLError } from '../src/utils/mathml.js';

// node.toMathML() returns a MathML *fragment* (like node.toTex() returns a
// LaTeX fragment); mathMLDocument() wraps it in a <math> element.
const mm = (src: string): string => parse(src).toMathML();
const doc = (src: string): string => mathMLDocument(parse(src));

describe('node.toMathML() (mirrors node.toTex())', () => {
  it('renders a symbol as <mi>, Greek-mapped', () => {
    expect(mm('x')).toBe('<mi>x</mi>');
    expect(mm('lambda')).toBe('<mi>λ</mi>');
    expect(mm('nu')).toBe('<mi>ν</mi>');
    expect(mm('mu')).toBe('<mi>μ</mi>');
  });

  it('renders integers and scientific notation', () => {
    expect(mm('42')).toBe('<mn>42</mn>');
    const sci = mm('8.8541878128e-12');
    expect(sci).toContain('<mn>8.8541878128</mn>');
    expect(sci).toContain('<mo>&#xD7;</mo>');
    expect(sci).toContain('<msup><mn>10</mn><mn>-12</mn></msup>');
  });

  it('renders a single-underscore name as a subscript', () => {
    expect(mm('a_0')).toBe('<msub><mi>a</mi><mn>0</mn></msub>');
    expect(mm('F_net')).toBe('<msub><mi>F</mi><mi>net</mi></msub>');
  });

  it('division -> mfrac, power -> msup', () => {
    expect(mm('a / b')).toContain('<mfrac>');
    expect(mm('x ^ 2')).toContain('<msup>');
  });

  it('sqrt -> msqrt, abs -> bars', () => {
    expect(mm('sqrt(x)')).toContain('<msqrt>');
    expect(mm('abs(x)')).toContain('<mo>|</mo>');
  });

  it('preserves precedence (-x^2 is -(x^2))', () => {
    const out = mm('-x^2');
    expect(out.indexOf('<mo>-</mo>')).toBeLessThan(out.indexOf('<msup>'));
  });

  it('renders the Maxwell equation (assignment + fraction + radical)', () => {
    const out = mm('c = 1 / sqrt(eps0 * mu0)');
    expect(out).toContain('<mi>c</mi>');
    expect(out).toContain('<mo>=</mo>');
    expect(out).toContain('<mfrac>');
    expect(out).toContain('<msqrt>');
  });

  it('renders chained relationals (RelationalNode), not flat text', () => {
    const out = mm('a < b < c');
    expect(out).not.toContain('<mtext>');
    expect((out.match(/<mo>&lt;<\/mo>/g) ?? []).length).toBe(2);
  });

  it('renders a postfix unary operator after its operand (factorial)', () => {
    expect(mm('5!')).toBe('<mrow><mn>5</mn><mo>!</mo></mrow>'); // not '!5'
  });

  it('falls back to text for an indexed assignment (keeps the index)', () => {
    const out = mm('a[2] = 3');
    expect(out).toContain('<mtext>');
    expect(out).toContain('a[2]'); // index preserved, not silently dropped
  });

  it('escapes string constants', () => {
    expect(mm('"a<b"')).toContain('a&lt;b');
  });

  it('degrades an unhandled node type to escaped <mtext> (never throws)', () => {
    expect(mm('[1, 2, 3]')).toContain('<mtext>'); // ArrayNode -> base fallback
  });
});

describe('mathMLDocument / mathMLError helpers', () => {
  it('wraps a fragment in a <math> element', () => {
    const d = doc('x');
    expect(d).toMatch(/^<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML" display="block">/);
    expect(d).toContain('<mi>x</mi>');
    expect(d).toMatch(/<\/math>$/);
  });

  it('mathMLError wraps escaped source in <merror> inside <math>', () => {
    const e = mathMLError('1 < 2');
    expect(e).toMatch(/^<math/);
    expect(e).toContain('<merror>');
    expect(e).toContain('1 &lt; 2');
  });
});
