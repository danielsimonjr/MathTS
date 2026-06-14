/**
 * Regression guard for the PUBLISHED entry point.
 *
 * package.json `files` ships only `dist`, so `dist/index.js` IS the public API.
 * core@0.1.2 was published to npm WITHOUT `Unit` in its export block even though
 * `src/index.ts` exported it — the committed dist predated the Unit-export commit
 * and was not rebuilt before publish. Downstream `@danielsimonjr/mathts-functions`
 * imports `Unit` from core, so consumers hit `Unit is undefined` at runtime.
 *
 * These assertions run against the built artifact (not src) so the
 * "fixed in source, missing in the build" failure mode fails loudly before
 * publish. Requires `npm run build` to have run first.
 */
import { describe, it, expect } from 'vitest';
import * as publicApi from '../dist/index.js';

describe('published core entry (dist) — Unit export contract', () => {
  it('exports the Unit class from the built entry', () => {
    expect(typeof publicApi.Unit).toBe('function');
  });

  it('exposes the runtime API that mathts-functions consumes', () => {
    const { Unit } = publicApi;

    // construction: new Unit(value, unitString)
    const u = new Unit(5, 'km');
    expect(u.type).toBe('Unit');
    expect(u.value).toBe(5000); // normalized to the base unit (metres)

    // conversion: .to(target)
    expect(typeof u.to).toBe('function');
    expect(u.to('m').value).toBe(5000);

    // best-prefix selection: .toBest()
    expect(typeof u.toBest).toBe('function');
    expect(u.toBest()).toBeInstanceOf(Unit);
  });
});
