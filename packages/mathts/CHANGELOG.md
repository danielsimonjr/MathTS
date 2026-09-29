# @danielsimonjr/mathts

## 0.1.0

### Minor Changes

- First publish of the consumer entry package. Re-exports `parse`, `evaluate`,
  and `simplify` from `@danielsimonjr/mathts-functions`, and ships subpath
  entries `./functions`, `./tensor`, and `./autograd` so one `npm install
  @danielsimonjr/mathts` covers the MathTS calls Universal-Physics-Tensor makes.

  ESM-only, `sideEffects: false`, `engines.node >= 20`, `engines.bun >= 1.4.2`.
  No bumping changeset: the package is new at `0.1.0`, and a changeset would
  move the first release to `0.2.0`. `changeset publish` publishes this version
  because it is not on the registry yet.
