# Security Policy

## Supported Versions

MathTS ships **24 independently versioned** `@danielsimonjr/mathts-*` packages (see root
`package.json` `workspaces`). The private root package (`mathts@0.1.0`) is not
published; security fixes land in the scoped packages consumers install.

We release patches for **currently published** package versions. Each workspace
`package.json` `"version"` field is the source of truth on `main`; after a release,
the same versions appear on the npm registry
and in the Changesets version PR / git tags (`<name>@<version>`).

| What to check                   | Where                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Version on `main` for a package | `<dir>/package.json` → `"version"` (workspace dir, e.g. `core/`)                                     |
| Versions already on npm         | `npm view @danielsimonjr/mathts-<name> version` (e.g. `npm view @danielsimonjr/mathts-core version`) |
| Pending version bumps           | `.changeset/*.md` and the Release workflow version PR                                                |

We do not maintain a single monolithic `0.1.x` support line. Install the latest
published version of each `@danielsimonjr/mathts-*` package you depend on, and
upgrade when a security advisory names a fixed version.

## Reporting a Vulnerability

If you discover a security vulnerability within MathTS, please follow these steps:

### 1. Do Not Open a Public Issue

Security vulnerabilities should **not** be reported through public GitHub issues.

### 2. Report Privately

Please report security vulnerabilities by emailing:

**security@mathts.dev** (or danielsimonjr@gmail.com)

Include the following information:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### 3. Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity, typically 30-90 days

### 4. Disclosure Policy

- We follow responsible disclosure practices
- We will coordinate with you on timing of public disclosure
- We will credit you in the security advisory (unless you prefer anonymity)

## Security Best Practices for Users

When using MathTS:

1. **Keep dependencies updated**: Regularly update to the latest version
2. **Validate inputs**: Always validate user inputs before passing to math functions
3. **Limit resource usage**: Set appropriate limits for matrix sizes and computation time
4. **Sandbox WebWorkers**: If using parallel execution, ensure proper isolation

## Known Security Considerations

### WebGPU Backend

- The GPU backend requires secure context (HTTPS)
- GPU memory is not automatically cleared between operations
- Consider the security implications of GPU-based computation in your environment

### WebWorkers

- Worker scripts should only load trusted code
- Worker communication is not encrypted by default

### WASM Backend

- WASM modules should only be loaded from trusted sources
- Memory is shared within the WASM instance

## Security Updates

Security fixes ship as patch (or minor) releases of the affected
`@danielsimonjr/mathts-*` packages and are announced via:

- GitHub Security Advisories
- Release notes
- npm package updates

## Acknowledgments

We thank the security researchers and community members who help keep MathTS secure.
