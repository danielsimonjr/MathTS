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
export const VERSION = '0.1.0';

/** Canonical dispatchable command list (advertised by `capabilities`; a test guards drift). */
export const COMMAND_NAMES = [
  'run', 'describe', 'validate', 'graph', 'strip', 'new',
  'capabilities', 'templates', 'cell', 'serve', 'functions', 'meta', 'export',
] as const;
