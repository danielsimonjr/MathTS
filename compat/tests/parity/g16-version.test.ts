import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import {
  create as createCompat,
  all as compatAll,
  compatVersion,
  version,
} from '../../src/index.js';
// The constant lives beside the binding it feeds; the deep import keeps it off the
// public surface (it is not a mathjs name).
import { MATHJS_PARITY_VERSION } from '../../src/instance-symbols.js';

function readCompatPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
    devDependencies: Record<string, string>;
  };
  return pkg.version;
}

describe('G16: version is the emulated mathjs version (#1581)', () => {
  it('the named export equals the mathjs oracle version', () => {
    const oracle = create(all, {});
    expect(version).toBe(oracle.version);
  });

  it('the instance property equals the mathjs oracle version', () => {
    const { mathjs, compat } = {
      mathjs: create(all, {}),
      compat: createCompat(compatAll, {}),
    };
    expect(compat.version).toBe(mathjs.version);
    expect(compat.version).toBe('15.3.0');
  });

  it('evaluate("version") reads the instance version on both libraries', () => {
    const mathjs = create(all, {});
    const compat = createCompat(compatAll, {});
    expect(compat.evaluate('version')).toBe(mathjs.evaluate('version'));
    expect(compat.evaluate('version')).toBe(compat.version);
    expect(compat.compile('version').evaluate()).toBe(compat.version);
    expect(compat.parser().evaluate('version')).toBe(compat.version);
  });

  it('MATHJS_PARITY_VERSION equals the mathjs devDependency', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies.mathjs).toBe(MATHJS_PARITY_VERSION);
  });

  it('compatVersion is the compat package version and differs from version', () => {
    expect(compatVersion).toBe(readCompatPackageVersion());
    expect(compatVersion).not.toBe(version);
    expect(typeof compatVersion).toBe('string');
  });

  it('the named export and the instance property are the same string', () => {
    const compat = createCompat(compatAll, {});
    expect(compat.version).toBe(version);
  });
});
