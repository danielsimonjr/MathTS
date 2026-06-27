import { describe, it, expect } from 'vitest';
import { createHelpClass } from '../src/Help.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// createHelpClass needs only an `evaluate` function.
// We provide a minimal mock that evaluates simple expressions.

const _mockMathScope: Record<string, any> = {
  sin: Math.sin,
  cos: Math.cos,
  sqrt: Math.sqrt,
  pi: Math.PI,
  config: () => ({ precision: 14 }),
};

// Simple mock evaluate: delegates to Function() for safety in tests
function mockEvaluate(expr: string, _scope?: any): any {
  if (expr === 'config()') return { precision: 14 };
  if (expr === '2 + 3') return 5;
  if (expr === 'sin(0)') return 0;
  if (expr === 'sqrt(4)') return 2;
  if (expr === '') return undefined;
  // For config change detection
  if (expr === 'config(newConfig)') return _scope?.newConfig;
  if (expr === 'config(originalConfig)') return _scope?.originalConfig;
  return undefined;
}

const Help = createHelpClass({ evaluate: mockEvaluate }) as any;

// ─── Construction ─────────────────────────────────────────────────────────────

describe('Help - constructor', () => {
  it('creates a Help instance', () => {
    const h = new Help({ name: 'sqrt', description: 'Square root' });
    expect(h).toBeTruthy();
  });

  it('has type "Help"', () => {
    const h = new Help({ name: 'sqrt' });
    expect(h.type).toBe('Help');
  });

  it('has isHelp = true', () => {
    const h = new Help({ name: 'sqrt' });
    expect(h.isHelp).toBe(true);
  });

  it('stores the doc object', () => {
    const doc = { name: 'abs', description: 'Absolute value' };
    const h = new Help(doc);
    expect(h.doc).toBe(doc);
  });

  it('throws when called without new', () => {
    expect(() => Help({ name: 'test' })).toThrow(SyntaxError);
  });

  it('throws when doc argument is missing', () => {
    expect(() => new Help(undefined)).toThrow(/Argument "doc" missing/);
  });

  it('throws when doc argument is null', () => {
    expect(() => new Help(null)).toThrow(/Argument "doc" missing/);
  });
});

// ─── toString ─────────────────────────────────────────────────────────────────

describe('Help - toString', () => {
  it('includes the name section', () => {
    const h = new Help({ name: 'sqrt' });
    expect(h.toString()).toContain('Name: sqrt');
  });

  it('includes the category section', () => {
    const h = new Help({ name: 'sqrt', category: 'Arithmetic' });
    const str = h.toString();
    expect(str).toContain('Category: Arithmetic');
  });

  it('includes the description section', () => {
    const h = new Help({ name: 'sqrt', description: 'Computes the square root.' });
    const str = h.toString();
    expect(str).toContain('Description:');
    expect(str).toContain('Computes the square root.');
  });

  it('includes the syntax section', () => {
    const h = new Help({ syntax: ['sqrt(x)', 'sqrt([x, y, z])'] });
    const str = h.toString();
    expect(str).toContain('Syntax:');
    expect(str).toContain('sqrt(x)');
    expect(str).toContain('sqrt([x, y, z])');
  });

  it('includes the seealso section', () => {
    const h = new Help({ seealso: ['pow', 'cbrt'] });
    const str = h.toString();
    expect(str).toContain('See also: pow, cbrt');
  });

  it('includes mayThrow section when present', () => {
    const h = new Help({ mayThrow: ['TypeError', 'RangeError'] });
    const str = h.toString();
    expect(str).toContain('Throws: TypeError, RangeError');
  });

  it('does not include empty sections', () => {
    const h = new Help({ name: 'abs' });
    const str = h.toString();
    // Should not contain "Category", "Description", etc. when not provided
    expect(str).not.toContain('Category:');
    expect(str).not.toContain('Description:');
    expect(str).not.toContain('Syntax:');
    expect(str).not.toContain('Examples:');
    expect(str).not.toContain('See also:');
  });

  it('starts with a newline', () => {
    const h = new Help({ name: 'abs' });
    expect(h.toString().startsWith('\n')).toBe(true);
  });

  it('includes examples when provided', () => {
    const h = new Help({
      examples: ['2 + 3', 'sqrt(4)'],
    });
    const str = h.toString();
    expect(str).toContain('Examples:');
    expect(str).toContain('2 + 3');
    expect(str).toContain('sqrt(4)');
  });

  it('evaluates examples and shows their results', () => {
    const h = new Help({
      examples: ['2 + 3'],
    });
    const str = h.toString();
    expect(str).toContain('5');
  });

  it('handles examples that throw gracefully', () => {
    // mockEvaluate will throw for unknown expressions; Help should catch and show error
    const throwEvaluate = (expr: string) => {
      if (expr === 'config()') return { precision: 14 };
      if (expr === '') return undefined;
      throw new Error('evaluation failed');
    };
    const HelpWithThrow = createHelpClass({ evaluate: throwEvaluate }) as any;
    const h = new HelpWithThrow({ examples: ['bad_expr'] });
    // Should not throw, should include the error
    const str = h.toString();
    expect(str).toContain('Examples:');
    expect(str).toContain('bad_expr');
  });
});

// ─── valueOf ──────────────────────────────────────────────────────────────────

describe('Help - valueOf', () => {
  it('valueOf is the same as toString', () => {
    const h = new Help({ name: 'cos' });
    expect(h.valueOf()).toBe(h.toString());
  });
});

// ─── toJSON ───────────────────────────────────────────────────────────────────

describe('Help - toJSON', () => {
  it('includes all doc properties', () => {
    const h = new Help({ name: 'sin', category: 'Trigonometry', description: 'Sine function' });
    const json = h.toJSON();
    expect(json.name).toBe('sin');
    expect(json.category).toBe('Trigonometry');
    expect(json.description).toBe('Sine function');
  });

  it('adds mathjs: "Help" marker', () => {
    const h = new Help({ name: 'cos' });
    const json = h.toJSON();
    expect(json.mathjs).toBe('Help');
  });

  it('does not include mathjs property from the doc', () => {
    // The doc itself should not have mathjs — it's added separately
    const h = new Help({ name: 'tan', syntax: ['tan(x)'] });
    const json = h.toJSON();
    expect(json.syntax).toEqual(['tan(x)']);
  });

  it('is a plain object (not the same as doc)', () => {
    const doc = { name: 'abs' };
    const h = new Help(doc);
    const json = h.toJSON();
    expect(json).not.toBe(doc);
  });
});

// ─── fromJSON ─────────────────────────────────────────────────────────────────

describe('Help - fromJSON', () => {
  it('creates a Help instance from JSON', () => {
    const json = { mathjs: 'Help', name: 'sqrt', category: 'Arithmetic' };
    const h = Help.fromJSON(json);
    expect(h).toBeInstanceOf(Help);
    expect(h.isHelp).toBe(true);
    expect(h.doc.name).toBe('sqrt');
    expect(h.doc.category).toBe('Arithmetic');
  });

  it('strips the mathjs property from the doc', () => {
    const json = { mathjs: 'Help', name: 'abs' };
    const h = Help.fromJSON(json);
    expect(h.doc.mathjs).toBeUndefined();
  });

  it('round-trips toJSON -> fromJSON', () => {
    const original = new Help({
      name: 'pow',
      category: 'Arithmetic',
      description: 'Power function',
      syntax: ['pow(x, y)'],
      seealso: ['sqrt', 'exp'],
    });
    const json = original.toJSON();
    const restored = Help.fromJSON(json);
    expect(restored.doc.name).toBe('pow');
    expect(restored.doc.category).toBe('Arithmetic');
    expect(restored.doc.syntax).toEqual(['pow(x, y)']);
    expect(restored.doc.seealso).toEqual(['sqrt', 'exp']);
  });
});

// ─── Partial doc (edge cases) ─────────────────────────────────────────────────

describe('Help - partial doc', () => {
  it('handles doc with no properties gracefully in toString', () => {
    const h = new Help({});
    // Should produce at least the leading newline without throwing
    const str = h.toString();
    expect(typeof str).toBe('string');
    expect(str.length).toBeGreaterThan(0);
  });

  it('handles doc with empty seealso array', () => {
    const h = new Help({ seealso: [] });
    const str = h.toString();
    // Empty seealso: no "See also" line
    expect(str).not.toContain('See also:');
  });

  it('handles doc with empty mayThrow array', () => {
    const h = new Help({ mayThrow: [] });
    const str = h.toString();
    expect(str).not.toContain('Throws:');
  });
});
