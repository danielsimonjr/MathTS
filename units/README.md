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

- `Unit` -- dimensional quantity class (`new Unit(5, 'km')`), with `.to()`, `.toBest()`, `.value`, `.type`. In TypeScript, annotate values as `Unit` (same name as the constructor) or `UnitInstance`.
- **`.value` is the SI magnitude**, not the number in the unit you wrote: `new Unit(180, 'deg').value` is `Math.PI` (radians for angles, meters for lengths, and so on). An offset temperature unit keeps its zero point, so `new Unit(0, 'degC').value` is `0`; read kelvin with `toNumeric('K')`. mathjs `Unit.value` follows the same rule. For the number in the unit that the quantity shows, call `.toNumeric()`. For the number in a named unit, call `.toNumeric('deg')`. `.toJSON().value` and `String(u)` also show the written number. `.toNumber(unit)` still works, but it is deprecated and it warns.
- **Logarithmic units.** `dB` and `dBW` are power quantities (`10 log10` of a power ratio). `dBm` is power referred to 1 mW (`0 dBm` = 1 mW). `Np` is a field quantity (`ln` of an amplitude ratio), so `1 Np` = `20/ln(10)` dB. `B` is the byte (8 bit), not the bel.
- `isUnit` / `isUnitValue` -- type guards.
- `DimensionMismatchError`, `UnitParseError` -- error types.
- Registry: `BASE_UNITS`, `DERIVED_UNITS`, `ALL_UNITS`, `UNIT_ALIASES`, `getUnitDef`.
- Prefixes: `SI_PREFIXES`, `BEST_PREFIXES`, `getPrefix`.
- `DIMENSIONLESS`, `dim`, and the `Dimensions` / `UnitDef` types.
- `toSiDimensionVector` / `fromSiDimensionVector` — `SiDimensionVector` exponents are core `Fraction`s (`SiDimensionExponent` is `number | Fraction` on the way in); `Unit.dimensions` remains `number[]`. Import `Fraction` from `@danielsimonjr/mathts-core` when comparing components.

```ts node
import { Unit, type UnitInstance } from '@danielsimonjr/mathts-units';

// Either annotation works:
// const a: Unit = new Unit(1, 'N');
// const b: UnitInstance = new Unit(1, 'N');
// .value is SI. After .to('m/s'), it is in m/s:
new Unit(100, 'km/h').to('m/s').value; // 27.77777777777778
// For 180° the .value is radians:
new Unit(180, 'deg').value; // 3.141592653589793
// For the 180 that you wrote, call toNumeric:
new Unit(180, 'deg').toNumeric('deg'); // 180
// An offset temperature unit keeps its zero point in .value:
new Unit(0, 'degC').value; // 0
new Unit(0, 'degC').toNumeric('K'); // 273.15
```

## License

MIT (c) Daniel Simon Jr.
