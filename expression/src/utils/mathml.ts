/**
 * MathML rendering helpers — the MathML analog of `utils/latex.ts`. Shared by
 * the per-node `_toMathML()` methods (mirroring how `utils/latex.ts` serves the
 * per-node `_toTex()` methods). Browsers typeset MathML natively, so the output
 * is self-contained (no fonts/JS/CDN).
 */

/** Symbol-name → glyph (the MathML analog of latexSymbols). */
const mathmlSymbols: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

/** Operator precedence (higher binds tighter) — for adding visual parens. */
const PRECEDENCE: Record<string, number> = {
  equal: 1, unequal: 1, smaller: 1, larger: 1, smallerEq: 1, largerEq: 1,
  add: 2, subtract: 2,
  multiply: 3, divide: 3, dotMultiply: 3, dotDivide: 3, mod: 3,
  unaryMinus: 4, unaryPlus: 4,
  pow: 5,
};

/** Operator fn → inline glyph (used between operands). */
const INLINE_OP: Record<string, string> = {
  add: '+', subtract: '-', equal: '=', unequal: '≠',
  smaller: '<', larger: '>', smallerEq: '≤', largerEq: '≥', mod: 'mod',
};

/** Escape text for a MathML/HTML text node. */
export function escapeMathML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mi(name: string): string {
  return `<mi>${mathmlSymbols[name] ?? escapeMathML(name)}</mi>`;
}

/** A symbol name → `<mi>` (Greek-mapped), or `name_sub` → `<msub>` (MathML analog of toSymbol). */
export function toMathMLSymbol(name: string): string {
  const us = name.indexOf('_');
  if (us > 0 && us < name.length - 1) {
    const base = name.slice(0, us);
    const sub = name.slice(us + 1);
    const subEl = /^\d+$/.test(sub) ? `<mn>${sub}</mn>` : mi(sub);
    return `<msub>${mi(base)}${subEl}</msub>`;
  }
  return mi(name);
}

/** A finite number → `<mn>`, with `8.85e-12` → mantissa × 10⁻¹². */
export function numberToMathML(value: number): string {
  if (!Number.isFinite(value)) return `<mn>${escapeMathML(String(value))}</mn>`;
  const s = String(value);
  const sci = /^(-?)(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(s);
  if (sci) {
    const sign = sci[1] ? '<mo>-</mo>' : '';
    const exp = String(parseInt(sci[3], 10));
    return `<mrow>${sign}<mn>${sci[2]}</mn><mo>&#xD7;</mo><msup><mn>10</mn><mn>${exp}</mn></msup></mrow>`;
  }
  if (value < 0) return `<mrow><mo>-</mo><mn>${escapeMathML(String(-value))}</mn></mrow>`;
  return `<mn>${escapeMathML(s)}</mn>`;
}

/** A ConstantNode value → MathML (number/bigint/boolean/string/other). */
export function constantToMathML(value: unknown): string {
  const t = typeof value;
  if (t === 'number') return numberToMathML(value as number);
  if (t === 'bigint') return `<mn>${escapeMathML(String(value))}</mn>`;
  if (t === 'boolean') return `<mi>${value as boolean}</mi>`;
  if (t === 'string') return `<mtext>${escapeMathML(value as string)}</mtext>`;
  return `<mtext>${escapeMathML(value === null ? 'null' : String(value))}</mtext>`;
}

/** Precedence of an operator fn (0 if unknown). */
export function operatorPrecedence(fn: string): number {
  return PRECEDENCE[fn] ?? 0;
}

/** The inline `<mo>` glyph for a binary operator fn (falls back to its `op`). */
export function inlineOperator(fn: string, op: string): string {
  return `<mo>${escapeMathML(INLINE_OP[fn] ?? op)}</mo>`;
}

/** Wrap an already-rendered child fragment in parens when it is a lower-precedence
 * operator under `parentFn` (so `(a+b)*c` reads correctly inline). */
export function parenthesizeLower(childFragment: string, childFn: string | undefined, parentFn: string): string {
  if (childFn !== undefined) {
    const cp = PRECEDENCE[childFn] ?? 0;
    const pp = PRECEDENCE[parentFn] ?? 0;
    if (cp > 0 && cp < pp) return `<mrow><mo>(</mo>${childFragment}<mo>)</mo></mrow>`;
  }
  return childFragment;
}

const MATH_OPEN = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">';

/** Wrap a MathML fragment (e.g. from `node.toMathML()`) in a `<math>` element. */
export function mathMLDocument(node: { toMathML(): string }): string {
  return `${MATH_OPEN}${node.toMathML()}</math>`;
}

/** A `<math>` element reporting a parse/render failure (escaped source). */
export function mathMLError(src: string): string {
  return `${MATH_OPEN}<merror><mtext>${escapeMathML(src)}</mtext></merror></math>`;
}
