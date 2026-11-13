import { describe, it, expect } from 'vitest';
import { create, all } from '@danielsimonjr/mathts-compat';
import { createParse } from '@danielsimonjr/mathts-parser';

/**
 * Issue #924: `createParse(create(all))` threw "some dependencies are missing"
 * for the AST node constructors. The factory must build them from the caller's
 * math scope, so a consumer needs no extra imports.
 */
describe('#924 createParse with a compat math instance', () => {
  it('#924 createParse(create(all)) parses 2+3 with no extra imports', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    expect(createParse(math)('2+3').toString()).toBe('2 + 3');
  });

  it('#924 nodes parsed with createParse(create(all)) evaluate through the compat scope', () => {
    // `factorial` exists only in the full compat instance, not in the default
    // arithmetic scope. The parsed node must resolve it through the caller's scope.
    const math = create(all) as unknown as Record<string, unknown>;
    const node = createParse(math)('factorial(5)');
    expect(node.compile().evaluate({})).toBe(120);
  });

  it('#924 createParse(create(all)) uses the isBounded of the compat scope', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    expect(createParse(math)('2+3').toTex()).toBe('2+3');
  });

  it('#924 a caller scope without a host function fails at construction, not with a stub', () => {
    // The scope the caller passes is the math scope of the nodes. `subset` is a host
    // function: only the default scope (no caller scope) gets a neutral stand-in.
    expect(() => createParse({})).toThrow(/subset/);
  });
});
