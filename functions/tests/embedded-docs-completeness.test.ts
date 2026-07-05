import { describe, it, expect } from 'vitest';
import { embeddedDocs } from '@danielsimonjr/mathts-expression';
import * as F from '../src/index.js';

/**
 * embeddedDocs completeness (the second half of the formerly-dormant expression
 * pocket, wired 2026-07-05): 92 doc files for MathTS-native extensions (CAS,
 * geometry, numeric, probability, signal, special) existed but were never
 * imported by the docs index, so `help()` could not see them. The one doc for a
 * function that does not exist (`distribution`, a removed mathjs factory) was
 * deleted rather than wired.
 */
describe('embeddedDocs — wired and truthful', () => {
  const docs = embeddedDocs as Record<string, { name?: string; description?: string }>;

  it('the formerly-unwired extension docs are present', () => {
    for (const name of [
      'polyFit',
      'gaussQuad',
      'autoCorrelation',
      'besselJ0',
      'erfc',
      'angle2D',
      'discriminant',
      'eliminate',
      'complexExpand',
      'fibonacci',
      'normalCDF',
      'entropy',
    ]) {
      expect(docs[name], `doc for ${name}`).toBeDefined();
      expect(docs[name].description).toBeTruthy();
    }
  });

  it('every documented FUNCTION exists in the functions surface (docs never lie)', () => {
    const fns = F as unknown as Record<string, unknown>;
    const missing: string[] = [];
    for (const [key, doc] of Object.entries(docs)) {
      const name = doc?.name ?? key;
      // constants/keywords/types documented in mathjs style are not functions
      if (typeof fns[name] === 'function') continue;
      if (name in fns) continue; // constants (pi, e, …)
      // expression-language-only constructs (keywords, operators, classes)
      const expressionOnly = new Set([
        'Infinity',
        'LN2',
        'LN10',
        'LOG2E',
        'LOG10E',
        'NaN',
        'SQRT1_2',
        'SQRT2',
        'version',
        'null',
        'true',
        'false',
        'i',
        'bignumber',
        'boolean',
        'complex',
        'fraction',
        'matrix',
        'sparse',
        'string',
        'unit',
        'createUnit',
        'splitUnit',
        'e',
        'pi',
        'phi',
        'tau', // expression-namespace constants (mathScope, not package exports)
        'config',
        'import',
        'typed',
        'derivative',
        'simplify',
        'rationalize',
        'evaluate',
        'parser',
        'parse',
        'compile',
        'help',
        'chain',
        'reviver',
        'replacer',
      ]);
      if (!expressionOnly.has(name)) missing.push(name);
    }
    expect(missing, `documented but nonexistent: ${missing.join(', ')}`).toEqual([]);
  });
});
