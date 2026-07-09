import { describe, it, expect } from 'vitest';
import * as parser from '../src/index.js';

/**
 * This package re-exports the parser surface from
 * `@danielsimonjr/mathts-expression`. These tests assert that the re-exported
 * symbols are present and are the genuine MathTS factory functions (with the
 * correct factory identity), so the focused entry point can't silently drift
 * from what `expression` provides. The parser's behaviour itself is covered by
 * the expression package's own `parse`/`Parser` tests.
 */
interface NodeFactory {
  isFactory: boolean;
  fn: string;
  dependencies: unknown[];
}

describe('@danielsimonjr/mathts-parser re-export surface', () => {
  it('exposes the parse function factory', () => {
    expect(typeof parser.createParse).toBe('function');
    expect((parser.createParse as unknown as NodeFactory).isFactory).toBe(true);
    expect((parser.createParse as unknown as NodeFactory).fn).toBe('parse');
    expect(Array.isArray((parser.createParse as unknown as NodeFactory).dependencies)).toBe(true);
  });

  it('exposes the Parser class factory', () => {
    expect(typeof parser.createParserClass).toBe('function');
    expect((parser.createParserClass as unknown as NodeFactory).isFactory).toBe(true);
    expect((parser.createParserClass as unknown as NodeFactory).fn).toBe('Parser');
  });

  it('exposes the parser() instance factory', () => {
    expect(typeof parser.createParser).toBe('function');
    expect((parser.createParser as unknown as NodeFactory).isFactory).toBe(true);
    expect((parser.createParser as unknown as NodeFactory).fn).toBe('parser');
  });

  it('exposes the AST node constructors the parser produces', () => {
    const nodeFactories = [
      parser.createNode,
      parser.createAccessorNode,
      parser.createArrayNode,
      parser.createAssignmentNode,
      parser.createBlockNode,
      parser.createConditionalNode,
      parser.createConstantNode,
      parser.createFunctionAssignmentNode,
      parser.createFunctionNode,
      parser.createIndexNode,
      parser.createObjectNode,
      parser.createOperatorNode,
      parser.createParenthesisNode,
      parser.createRangeNode,
      parser.createRelationalNode,
      parser.createSymbolNode,
    ];
    for (const f of nodeFactories) {
      expect(typeof f).toBe('function');
      expect((f as unknown as NodeFactory).isFactory).toBe(true);
    }
  });

  it('exposes the operator/keyword metadata the parser relies on', () => {
    expect(parser.keywords instanceof Set).toBe(true);
    expect(Array.isArray(parser.properties)).toBe(true);
    expect(typeof parser.getPrecedence).toBe('function');
    expect(typeof parser.getAssociativity).toBe('function');
    expect(typeof parser.isAssociativeWith).toBe('function');
    expect(typeof parser.getOperator).toBe('function');
  });
});
