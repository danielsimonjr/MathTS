/**
 * Render an expression AST node to MathML — a MathTS-native, dependency-free
 * math serializer that sits alongside `_toTex`/`toHTML`/`toString`. Browsers
 * typeset MathML natively, so the output is self-contained (no fonts/JS/CDN).
 *
 * Takes an already-parsed node (parsing is the caller's job — the assembled
 * `parse` lives in the functions package). Duck-typed on `node.type`, so it
 * needs no hard dependency on the node classes. Never throws: an unknown node
 * degrades to escaped `<mtext>`, and `toMathML` wraps render errors in `<merror>`.
 */

/** Structural view of an AST node (duck-typed). */
type MNode = Record<string, unknown>;

const MATH_OPEN = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">';

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

/** Operator precedence (higher binds tighter) — for adding visual parens. */
const PREC: Record<string, number> = {
  equal: 1, unequal: 1, smaller: 1, larger: 1, smallerEq: 1, largerEq: 1,
  add: 2, subtract: 2,
  multiply: 3, divide: 3, dotMultiply: 3, mod: 3,
  unaryMinus: 4, unaryPlus: 4,
  pow: 5,
};

const INLINE_OP: Record<string, string> = {
  add: '+', subtract: '-', equal: '=', unequal: '≠',
  smaller: '<', larger: '>', smallerEq: '≤', largerEq: '≥', mod: 'mod',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function asNode(v: unknown): MNode | null {
  return v !== null && typeof v === 'object' ? (v as MNode) : null;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function nodeType(n: MNode): string {
  return str(n.type);
}
function argsOf(n: MNode): MNode[] {
  const a = n.args;
  if (!Array.isArray(a)) return [];
  return a.filter((x): x is MNode => x !== null && typeof x === 'object');
}
function safeToString(n: MNode): string {
  try {
    const f = n.toString;
    return typeof f === 'function' ? String((f as () => unknown).call(n)) : '';
  } catch {
    return '';
  }
}
function fallback(n: MNode): string {
  return `<mtext>${esc(safeToString(n))}</mtext>`;
}
function mi(name: string): string {
  return `<mi>${GREEK[name] ?? esc(name)}</mi>`;
}

function symbolMathML(name: string): string {
  const us = name.indexOf('_');
  if (us > 0 && us < name.length - 1) {
    const base = name.slice(0, us);
    const sub = name.slice(us + 1);
    const subEl = /^\d+$/.test(sub) ? `<mn>${sub}</mn>` : mi(sub);
    return `<msub>${mi(base)}${subEl}</msub>`;
  }
  return mi(name);
}

function numberMathML(value: number): string {
  if (!Number.isFinite(value)) return `<mn>${esc(String(value))}</mn>`;
  const s = String(value);
  const sci = /^(-?)(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(s);
  if (sci) {
    const sign = sci[1] ? '<mo>-</mo>' : '';
    const exp = String(parseInt(sci[3], 10));
    return `<mrow>${sign}<mn>${sci[2]}</mn><mo>&#xD7;</mo><msup><mn>10</mn><mn>${exp}</mn></msup></mrow>`;
  }
  if (value < 0) return `<mrow><mo>-</mo><mn>${esc(String(-value))}</mn></mrow>`;
  return `<mn>${esc(s)}</mn>`;
}

function constantMathML(value: unknown): string {
  const t = typeof value;
  if (t === 'number') return numberMathML(value as number);
  if (t === 'bigint') return `<mn>${esc(String(value))}</mn>`;
  if (t === 'boolean') return `<mi>${value as boolean}</mi>`;
  if (t === 'string') return `<mtext>${esc(value as string)}</mtext>`;
  return `<mtext>${esc(value === null ? 'null' : String(value))}</mtext>`;
}

/** Render a child, wrapping a lower-precedence inline operator in parens. */
function child(parent: MNode, childNode: MNode): string {
  const inner = render(childNode);
  if (nodeType(childNode) === 'OperatorNode') {
    const pp = PREC[str(parent.fn)] ?? 0;
    const cp = PREC[str(childNode.fn)] ?? 0;
    if (cp > 0 && cp < pp) return `<mrow><mo>(</mo>${inner}<mo>)</mo></mrow>`;
  }
  return inner;
}

function operatorMathML(n: MNode): string {
  const fn = str(n.fn);
  const args = argsOf(n);
  if (fn === 'divide' && args.length === 2) {
    return `<mfrac><mrow>${render(args[0])}</mrow><mrow>${render(args[1])}</mrow></mfrac>`;
  }
  if (fn === 'pow' && args.length === 2) {
    return `<msup><mrow>${render(args[0])}</mrow><mrow>${render(args[1])}</mrow></msup>`;
  }
  if (args.length === 1) {
    const op = n.op === '-' || n.op === '+' ? str(n.op) : esc(str(n.op));
    return `<mrow><mo>${op}</mo>${child(n, args[0])}</mrow>`;
  }
  if (args.length >= 2) {
    const opMml =
      fn === 'multiply'
        ? n.implicit === true
          ? '<mo>&#x2062;</mo>'
          : '<mo>&#x22C5;</mo>'
        : `<mo>${esc(INLINE_OP[fn] ?? str(n.op))}</mo>`;
    return `<mrow>${args.map((a) => child(n, a)).join(opMml)}</mrow>`;
  }
  return fallback(n);
}

function functionMathML(n: MNode): string {
  const fnNode = asNode(n.fn);
  const name = fnNode ? str(fnNode.name) : str(n.fn);
  const args = argsOf(n);
  if (name === 'sqrt' && args.length === 1) return `<msqrt>${render(args[0])}</msqrt>`;
  if (name === 'cbrt' && args.length === 1) {
    return `<mroot><mrow>${render(args[0])}</mrow><mn>3</mn></mroot>`;
  }
  if (name === 'nthRoot' && args.length === 2) {
    return `<mroot><mrow>${render(args[0])}</mrow><mrow>${render(args[1])}</mrow></mroot>`;
  }
  if (name === 'abs' && args.length === 1) {
    return `<mrow><mo>|</mo>${render(args[0])}<mo>|</mo></mrow>`;
  }
  const inner = args.map((a) => render(a)).join('<mo>,</mo>');
  return `<mrow>${mi(name)}<mo>&#x2061;</mo><mrow><mo>(</mo>${inner}<mo>)</mo></mrow></mrow>`;
}

function render(node: MNode): string {
  switch (nodeType(node)) {
    case 'ConstantNode':
      return constantMathML(node.value);
    case 'SymbolNode':
      return symbolMathML(str(node.name));
    case 'ParenthesisNode': {
      const content = asNode(node.content);
      return content ? `<mrow><mo>(</mo>${render(content)}<mo>)</mo></mrow>` : fallback(node);
    }
    case 'AssignmentNode': {
      const obj = asNode(node.object);
      const value = asNode(node.value);
      if (obj && nodeType(obj) === 'SymbolNode' && value) {
        return `<mrow>${symbolMathML(str(obj.name))}<mo>=</mo>${render(value)}</mrow>`;
      }
      return fallback(node);
    }
    case 'OperatorNode':
      return operatorMathML(node);
    case 'FunctionNode':
      return functionMathML(node);
    case 'RelationalNode': {
      // Chained comparison (a < b <= c): conditionals[] between params[].
      const params = Array.isArray(node.params)
        ? node.params.filter((x): x is MNode => x !== null && typeof x === 'object')
        : [];
      const conds = Array.isArray(node.conditionals) ? (node.conditionals as unknown[]) : [];
      if (params.length >= 2 && conds.length === params.length - 1) {
        let out = render(params[0]);
        for (let i = 0; i < conds.length; i++) {
          const op = str(conds[i]);
          out += `<mo>${esc(INLINE_OP[op] ?? op)}</mo>${render(params[i + 1])}`;
        }
        return `<mrow>${out}</mrow>`;
      }
      return fallback(node);
    }
    default:
      return fallback(node);
  }
}

/** Render an AST node to a self-contained `<math>` element. Never throws. */
export function toMathML(node: unknown): string {
  let body: string;
  try {
    const n = asNode(node);
    body = n ? render(n) : '<merror><mtext></mtext></merror>';
  } catch {
    body = '<merror><mtext>render error</mtext></merror>';
  }
  return `${MATH_OPEN}${body}</math>`;
}

/** Build a `<math>` element reporting a parse failure (escaped source). */
export function mathMLError(src: string): string {
  return `${MATH_OPEN}<merror><mtext>${esc(src)}</mtext></merror></math>`;
}
