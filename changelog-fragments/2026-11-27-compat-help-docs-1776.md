### Fixed

- **Compat `help()` matches mathjs 15.3.0 embedded docs (#1776):** resolve documentation from constant values and function references via live `mathWithTransform`, use safe embedded-doc lookup (including `compatBlockResultSet`), typed arity errors, and batch `evaluate` on doc example lists with shared assignment scope.
