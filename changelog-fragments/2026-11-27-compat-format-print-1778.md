### Fixed

- **Compat `format` / `print` (#1778):** Instance `format` no longer injects `config.precision` into options objects that omit it, restoring mathjs engineering notation and fixed complex output. `format(bignumber)` with no second argument still uses instance precision; arity errors delegate to typed-function. `print` converts Matrix value containers to arrays, only intercepts two- and three-argument calls (so arity checks run), and keeps trailing-period templates intact.
