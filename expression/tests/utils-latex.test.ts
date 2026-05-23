import { describe, it, expect } from 'vitest';
import {
  latexSymbols,
  latexOperators,
  latexFunctions,
  defaultTemplate,
  escapeLatex,
  toSymbol,
} from '../src/utils/latex.js';

// ---------------------------------------------------------------------------
// latexSymbols
// ---------------------------------------------------------------------------
describe('latexSymbols', () => {
  it('contains the correct LaTeX representation for Greek letters', () => {
    expect(latexSymbols.alpha).toBe('\\alpha');
    expect(latexSymbols.pi).toBe('\\pi');
    expect(latexSymbols.omega).toBe('\\omega');
    expect(latexSymbols.Gamma).toBe('\\Gamma');
    expect(latexSymbols.Delta).toBe('\\Delta');
  });

  it('maps special symbols correctly', () => {
    expect(latexSymbols.infinity).toBe('\\infty');
    expect(latexSymbols.Infinity).toBe('\\infty');
    expect(latexSymbols.oo).toBe('\\infty');
    expect(latexSymbols.undefined).toBe('\\mathbf{?}');
    expect(latexSymbols.true).toBe('\\mathrm{True}');
    expect(latexSymbols.false).toBe('\\mathrm{False}');
    expect(latexSymbols.i).toBe('i');
  });

  it('maps Alpha (uppercase) to plain "A"', () => {
    expect(latexSymbols.Alpha).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// latexOperators
// ---------------------------------------------------------------------------
describe('latexOperators', () => {
  it('maps arithmetic operators', () => {
    expect(latexOperators.add).toBe('+');
    expect(latexOperators.subtract).toBe('-');
    expect(latexOperators.multiply).toBe('\\cdot');
    expect(latexOperators.divide).toBe('\\frac');
    expect(latexOperators.pow).toBe('^');
  });

  it('maps comparison operators', () => {
    expect(latexOperators.equal).toBe('=');
    expect(latexOperators.unequal).toBe('\\neq');
    expect(latexOperators.smaller).toBe('<');
    expect(latexOperators.larger).toBe('>');
    expect(latexOperators.smallerEq).toBe('\\leq');
    expect(latexOperators.largerEq).toBe('\\geq');
  });

  it('maps logical operators', () => {
    expect(latexOperators.and).toBe('\\wedge');
    expect(latexOperators.or).toBe('\\vee');
    expect(latexOperators.not).toBe('\\neg');
  });

  it('maps unary operators', () => {
    expect(latexOperators.unaryPlus).toBe('+');
    expect(latexOperators.unaryMinus).toBe('-');
    expect(latexOperators.factorial).toBe('!');
    expect(latexOperators.transpose).toBe('^\\top');
  });
});

// ---------------------------------------------------------------------------
// latexFunctions
// ---------------------------------------------------------------------------
describe('latexFunctions', () => {
  it('has a template for abs with one argument', () => {
    expect((latexFunctions.abs as any)[1]).toBe('\\left|${args[0]}\\right|');
  });

  it('has a template for sqrt', () => {
    expect((latexFunctions.sqrt as any)[1]).toBe('\\sqrt{${args[0]}}');
  });

  it('has a template for divide (fraction form)', () => {
    expect((latexFunctions.divide as any)[2]).toBe('\\frac{${args[0]}}{${args[1]}}');
  });

  it('has a template for sin', () => {
    expect((latexFunctions.sin as any)[1]).toBe('\\sin\\left(${args[0]}\\right)');
  });

  it('has string templates (not objects) for variadic functions like max/min', () => {
    expect(typeof latexFunctions.max).toBe('string');
    expect(typeof latexFunctions.min).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// defaultTemplate
// ---------------------------------------------------------------------------
describe('defaultTemplate', () => {
  it('is a string containing ${name} and ${args}', () => {
    expect(typeof defaultTemplate).toBe('string');
    expect(defaultTemplate).toContain('${name}');
    expect(defaultTemplate).toContain('${args}');
  });
});

// ---------------------------------------------------------------------------
// escapeLatex
// ---------------------------------------------------------------------------
describe('escapeLatex', () => {
  it('escapes special LaTeX characters', () => {
    // Underscores are LaTeX special characters
    const result = escapeLatex('a_b');
    expect(result).toContain('a');
    expect(result).toContain('b');
    // The escape-latex library should have escaped the underscore
    expect(result).not.toBe('a_b');
  });

  it('leaves normal alphanumeric strings unchanged', () => {
    expect(escapeLatex('hello123')).toBe('hello123');
  });

  it('escapes percent signs', () => {
    const result = escapeLatex('50%');
    expect(result).toContain('%');
    expect(result).not.toBe('50%');
  });
});

// ---------------------------------------------------------------------------
// toSymbol
// ---------------------------------------------------------------------------
describe('toSymbol', () => {
  it('returns the LaTeX representation for a known symbol', () => {
    expect(toSymbol('alpha', false)).toBe('\\alpha');
    expect(toSymbol('pi', false)).toBe('\\pi');
    expect(toSymbol('Infinity', false)).toBe('\\infty');
  });

  it('returns escaped name for unknown symbols', () => {
    // 'myVar' is not in latexSymbols, so it should just escape the name
    const result = toSymbol('myVar', false);
    expect(result).toBe('myVar');
  });

  it('returns the deg unit as ^\\circ', () => {
    expect(toSymbol('deg', true)).toBe('^\\circ');
  });

  it('wraps unknown units in \\mathrm{}', () => {
    const result = toSymbol('km', true);
    expect(result).toBe('\\mathrm{km}');
  });

  it('defaults isUnit to false when not provided', () => {
    // Should return the symbol, not treat it as a unit
    expect(toSymbol('alpha', undefined as any)).toBe('\\alpha');
  });
});
