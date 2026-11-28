### Fixed

- **Compat matrix oracle loader (#1785):** `create(all).gcd` uses the factory wrapper again so mathjs unit tests see `ArgumentsError` on multidimensional inputs. Added a canonical mocha harness under `compat/scripts/` (redirect `defaultInstance`, `create`, `factory`, and public error entry points to `compat/dist/index.js`).
