import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';

const ORACLE_VERSION = '15.3.0';

describe('mathjs parity oracle pin', () => {
  it('compat pins the mathjs devDependency at the oracle version', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies.mathjs).toBe(ORACLE_VERSION);
  });

  it('the installed mathjs instance reports the oracle version', () => {
    const math = create(all, {});
    expect(math.version).toBe(ORACLE_VERSION);
  });
});
