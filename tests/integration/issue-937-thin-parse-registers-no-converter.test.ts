import { describe, it, expect } from 'vitest';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { createParse, parse } from '@danielsimonjr/mathts-parser';

/**
 * Issue #937: the shared typed instance holds one string-to-Node converter, and
 * that converter must build the node classes of the functions that take a Node.
 * `@danielsimonjr/mathts-functions` owns those functions, so it registers the
 * converter. A parse factory run registers none, whatever the load order.
 *
 * This file never imports functions: any parse run here must leave the shared
 * typed instance without a string-to-Node converter.
 */
describe('#937 a parse factory run registers no string-to-Node converter', () => {
  it('#937 the default parse and two createParse() runs leave the shared typed untouched', () => {
    expect(() => mathTyped.convert('x + x', 'Node')).toThrow();
    parse('2+3');
    createParse();
    createParse();
    expect(() => mathTyped.convert('x + x', 'Node')).toThrow();
  });
});
