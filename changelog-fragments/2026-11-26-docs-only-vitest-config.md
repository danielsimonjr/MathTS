### Fixed

- **Docs-only CI runs package documentation tests with that package's Vitest config:** the root config only includes `tests/docs`, `tests/integration`, and `tests/wasm`, so files such as `functions/tests/docs-reference-completeness.test.ts` exited with "No test files found" on every docs-only pull request.
