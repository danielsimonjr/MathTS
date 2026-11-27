import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Unit } from '@danielsimonjr/mathts-core';
import { evaluate } from '@danielsimonjr/mathts-functions';
import { all, create } from '../src/index.js';
import { wrapCompatUnitConstructor } from '../src/mathjs-unit.js';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function nativeUnitSnapshot(): {
  d: boolean;
  cm: boolean;
  evalD: string;
  evalCm: string;
} {
  return {
    d: Unit.isValuelessUnit('d'),
    cm: Unit.isValuelessUnit('cm'),
    evalD: String(evaluate('d')),
    evalCm: String(evaluate('cm')),
  };
}

function snapshotFromFreshProcess(): ReturnType<typeof nativeUnitSnapshot> {
  const core = resolve(repoRoot, 'core/dist/index.js');
  const functions = resolve(repoRoot, 'functions/dist/index.js');
  const script = `
    import { Unit } from ${JSON.stringify(core)};
    import { evaluate } from ${JSON.stringify(functions)};
    process.stdout.write(JSON.stringify({
      d: Unit.isValuelessUnit('d'),
      cm: Unit.isValuelessUnit('cm'),
      evalD: String(evaluate('d')),
      evalCm: String(evaluate('cm')),
    }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as ReturnType<typeof nativeUnitSnapshot>;
}

describe('compat Unit constructor isolation (#1557)', () => {
  it('does not rewrite the shared native Unit class', () => {
    const before = nativeUnitSnapshot();
    expect(before.d).toBe(true);
    expect(before.cm).toBe(true);

    const math = create(all);
    const after = nativeUnitSnapshot();
    const fresh = snapshotFromFreshProcess();

    expect(after).toEqual(before);
    expect(after).toEqual(fresh);

    expect(math.Unit).not.toBe(Unit);
    expect(math.Unit.isValuelessUnit('d')).toBe(false);
    expect(math.Unit.isValuelessUnit('cm')).toBe(true);

    const meter = new math.Unit(1, 'm');
    expect(meter).toBeInstanceOf(math.Unit);
    expect(() => math.evaluate('d')).toThrow(/Undefined symbol "?d"?/);
    expect(String(math.evaluate('cm'))).toBe(String(evaluate('cm')));
  });

  it('wrapCompatUnitConstructor leaves Base.isValuelessUnit unchanged', () => {
    const original = Unit.isValuelessUnit;
    const wrapped = wrapCompatUnitConstructor(Unit);
    expect(Unit.isValuelessUnit).toBe(original);
    expect(Unit.isValuelessUnit('d')).toBe(true);
    expect(wrapped.isValuelessUnit('d')).toBe(false);
    expect(wrapped.isValuelessUnit('cm')).toBe(true);
    expect(new wrapped(2, 's')).toBeInstanceOf(wrapped);
    expect(new Unit(1, 'm')).toBeInstanceOf(wrapped);
  });
});
