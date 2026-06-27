/**
 * Machine-contract constants shared by the CLI and the public API.
 *
 * `SCHEMA_VERSION` is the version of the `--json` envelope shape. Clients
 * negotiate with the rule: ignore unknown fields when `major` matches; refuse
 * on a `major` mismatch. Additive fields bump `minor`; breaking changes bump
 * `major`.
 */
export const SCHEMA_VERSION = { major: 1, minor: 0 } as const;
