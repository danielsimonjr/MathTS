### Fixed

- **`Complex` `valueOf` and `format` match mathjs 15.3.0 (#1781):** compat now sets `valueOf` to the string form (not magnitude) and uses mathjs ratio-based epsilon rounding plus numeric precision shorthand in `format`.
