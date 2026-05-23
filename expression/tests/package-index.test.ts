/**
 * Smoke test for expression/src/index.ts (package entry barrel)
 *
 * Asserts that a representative sample of named exports from the public
 * API are present and have the expected types.
 */
import { describe, it, expect } from 'vitest';
import * as expr from '../src/index.js';

describe('expression/src/index.ts – package entry smoke test', () => {
  it('exports compile as a function (via compiler barrel)', () => {
    expect(typeof expr.compile).toBe('function');
  });

  it('exports createEvaluate and compileExpression as functions (via evaluator barrel)', () => {
    expect(typeof expr.createEvaluate).toBe('function');
    expect(typeof expr.compileExpression).toBe('function');
  });

  it('exports node constructor factories as functions', () => {
    expect(typeof expr.createNode).toBe('function');
    expect(typeof expr.createConstantNode).toBe('function');
    expect(typeof expr.createSymbolNode).toBe('function');
    expect(typeof expr.createOperatorNode).toBe('function');
    expect(typeof expr.createFunctionNode).toBe('function');
    expect(typeof expr.createArrayNode).toBe('function');
  });

  it('exports createParse, createParserClass, createHelpClass as functions', () => {
    expect(typeof expr.createParse).toBe('function');
    expect(typeof expr.createParserClass).toBe('function');
    expect(typeof expr.createHelpClass).toBe('function');
  });

  it('exports keywords set', () => {
    expect(expr.keywords).toBeDefined();
  });
});
