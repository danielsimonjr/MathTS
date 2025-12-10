# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within MathTS, please follow these steps:

### 1. Do Not Open a Public Issue

Security vulnerabilities should **not** be reported through public GitHub issues.

### 2. Report Privately

Please report security vulnerabilities by emailing:

**[INSERT SECURITY EMAIL]**

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

Security updates will be released as patch versions (e.g., 0.1.x) and announced via:

- GitHub Security Advisories
- Release notes
- npm package updates

## Acknowledgments

We thank the security researchers and community members who help keep MathTS secure.
