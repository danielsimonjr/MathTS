# @danielsimonjr/mathts-units

Standalone units & dimensional analysis for [MathTS](https://github.com/danielsimonjr/mathts).

A focused entry point over the unit system in
[`@danielsimonjr/mathts-core`](https://www.npmjs.com/package/@danielsimonjr/mathts-core).
The implementation is re-exported, not duplicated.

## Install

```sh
npm install @danielsimonjr/mathts-units
```

## What it exports

- `Unit` -- dimensional quantity class (`new Unit(5, 'km')`), with `.to()`, `.toBest()`, `.value`, `.type`.
- `isUnit` / `isUnitValue` -- type guards.
- `DimensionMismatchError`, `UnitParseError` -- error types.
- Registry: `BASE_UNITS`, `DERIVED_UNITS`, `ALL_UNITS`, `UNIT_ALIASES`, `getUnitDef`.
- Prefixes: `SI_PREFIXES`, `BEST_PREFIXES`, `getPrefix`.
- `DIMENSIONLESS`, `dim`, and the `Dimensions` / `UnitDef` types.
- `toSiDimensionVector` / `fromSiDimensionVector` — `SiDimensionVector` exponents are core `Fraction`s (`SiDimensionExponent` is `number | Fraction` on the way in); `Unit.dimensions` remains `number[]`. Import `Fraction` from `@danielsimonjr/mathts-core` when comparing components.

```ts
import { Unit } from '@danielsimonjr/mathts-units';
new Unit(100, 'km/h').to('m/s').value; // 27.777...
```

## License

MIT (c) Daniel Simon Jr.
