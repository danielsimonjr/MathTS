### Fixed

- **Auto-resize matrix on indexed assignment (#1557):** the indexed-assignment path routes through the resizing `subset` implementation, so growing an empty matrix matches mathjs 15.3.0 (`e = []; e[1, 1:2] = [5, 6]; e[2, :] = [7, 8]` is `[[5, 6], [7, 8]]`, and 1-D `a = []; a[3] = 4` is `[0, 0, 4]`). A new differential suite (`compat/tests/parity/g09-resize-assign.test.ts`) pins the expression rows, the direct `subset` controls, scalar/range/`:` growth in 1-D and 2-D, and the `subset` docs example `f = d * e` against the mathjs 15.3.0 oracle.
