/**
 * Machine-contract constants shared by the CLI and the public API.
 *
 * `SCHEMA_VERSION` is the version of the `--json` envelope shape. Clients
 * negotiate with the rule: ignore unknown fields when `major` matches; refuse
 * on a `major` mismatch. Additive fields bump `minor`; breaking changes bump
 * `major`.
 */
export const SCHEMA_VERSION = { major: 1, minor: 0 } as const;

/** Package/engine version reported by `--version`, `capabilities`, and serve. */
// Injected at build time by tsdown's `define` (see tsdown.config.ts) from this
// package's package.json version, so VERSION can never drift (and `mtsw
// version` always reports the real published version).
declare const __PKG_VERSION__: string;
export const VERSION: string = readDefinedPkgVersion();

function readDefinedPkgVersion(): string {
  try {
    return __PKG_VERSION__;
  } catch (error) {
    if (error instanceof ReferenceError) {
      const injected = (globalThis as { __PKG_VERSION__?: string }).__PKG_VERSION__;
      if (typeof injected === 'string') return injected;
    }
    throw error;
  }
}

/** Canonical dispatchable command list (advertised by `capabilities`; a test guards drift). */
export const COMMAND_NAMES = [
  'run',
  'describe',
  'validate',
  'graph',
  'strip',
  'new',
  'capabilities',
  'templates',
  'cell',
  'serve',
  'functions',
  'meta',
  'import',
  'export',
] as const;
