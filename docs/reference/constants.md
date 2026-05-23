# Constants

Mathematical constants are available as named exports from `@danielsimonjr/mathts-core`.

## Usage

```typescript
import { PI, E, PHI, TAU } from '@danielsimonjr/mathts-core';

Math.sin(PI / 4); // 0.7071067811865476
E ** 2; // 7.38905609893065
```

For use inside expression strings, the constants are also in the expression evaluator scope:

```typescript
import { evaluate } from '@danielsimonjr/mathts-functions';

evaluate('sin(pi / 4)'); // 0.7071067811865476
evaluate('e ^ 2'); // 7.38905609893065
```

## Constant Table

| Constant  | Export name | Description                               | Value                |
| --------- | ----------- | ----------------------------------------- | -------------------- |
| pi, π     | `PI`        | Ratio of circle circumference to diameter | `3.141592653589793`  |
| tau, τ    | `TAU`       | Full-circle constant, `2 * pi`            | `6.283185307179586`  |
| e         | `E`         | Euler's number, base of natural logarithm | `2.718281828459045`  |
| phi, φ    | `PHI`       | Golden ratio, `(1 + sqrt(5)) / 2`         | `1.618033988749895`  |
| i         | `I`         | Imaginary unit (`i² = -1`)                | `Complex(0, 1)`      |
| sqrt(2)   | `SQRT2`     | Square root of 2                          | `1.4142135623730951` |
| sqrt(1/2) | `SQRT1_2`   | Square root of one-half                   | `0.7071067811865476` |
| ln(2)     | `LN2`       | Natural logarithm of 2                    | `0.6931471805599453` |
| ln(10)    | `LN10`      | Natural logarithm of 10                   | `2.302585092994046`  |
| log2(e)   | `LOG2E`     | Base-2 logarithm of e                     | `1.4426950408889634` |
| log10(e)  | `LOG10E`    | Base-10 logarithm of e                    | `0.4342944819032518` |
| Infinity  | `Infinity`  | Positive infinity                         | `Infinity`           |
| NaN       | `NaN`       | Not a Number                              | `NaN`                |
| null      | `null`      | Null value                                | `null`               |

## Physical Constants

CODATA physical constants are exported from `@danielsimonjr/mathts-functions`.
Unit-valued constants are `Unit` instances (use `.toNumeric(targetUnit?)` to read
a number); dimensionless constants (`fineStructure`, `weakMixingAngle`,
`efimovFactor`, `sackurTetrode`) are plain numbers.

```typescript
import { speedOfLight, planckConstant, avogadro } from '@danielsimonjr/mathts-functions';

speedOfLight.toNumeric(); // 299792458
planckConstant.toNumeric(); // 6.62607015e-34
avogadro.toNumeric(); // 6.02214076e23
```

| Group            | Constants                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Universal        | `speedOfLight`, `gravitationConstant`, `planckConstant`, `reducedPlanckConstant`                                                                                                                                                                  |
| Electromagnetic  | `magneticConstant`, `electricConstant`, `vacuumImpedance`, `coulomb`, `coulombConstant`, `elementaryCharge`, `bohrMagneton`, `conductanceQuantum`, `inverseConductanceQuantum`, `magneticFluxQuantum`, `nuclearMagneton`, `klitzing`, `josephson` |
| Atomic & nuclear | `electronMass`, `protonMass`, `neutronMass`, `deuteronMass`, `atomicMass`, `bohrRadius`, `classicalElectronRadius`, `hartreeEnergy`, `rydberg`, `thomsonCrossSection`, `quantumOfCirculation`, `fineStructure`                                    |
| Physico-chemical | `faraday`, `boltzmann`, `gasConstant`, `molarVolume`, `molarMass`, `molarMassC12`, `molarPlanckConstant`, `avogadro`, `loschmidt`, `sackurTetrode`, `stefanBoltzmann`, `firstRadiation`, `secondRadiation`, `wienDisplacement`                    |
| Other            | `gravity`, `planckLength`, `planckMass`, `planckTime`, `planckCharge`, `planckTemperature`, `weakMixingAngle`, `efimovFactor`, `fermiCoupling`                                                                                                    |

> Activated under the default `number` configuration. BigNumber-precision
> physical constants are not yet wired (see `docs/roadmap/EXPANSION_PLAN.md`).

## BigNumber Constants

For arbitrary-precision constants, use `BigNumber` arithmetic:

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';

BigNumber.config({ precision: 50 });
const pi50 = BigNumber.parse('3.14159265358979323846264338327950288419716939937');
```

## Examples

```typescript
import { PI, E, PHI, I } from '@danielsimonjr/mathts-core';
import { Complex } from '@danielsimonjr/mathts-core';
import { sin, cos, multiply, add } from '@danielsimonjr/mathts-functions';

// Euler's identity: e^(i*pi) + 1 = 0
const eipi = I.mul(new Complex(PI, 0)).exp().add(new Complex(1, 0));
// ≈ Complex(0, 0) — floating point noise

// Golden ratio property: phi^2 = phi + 1
PHI * PHI; // 2.618033988749895
PHI + 1; // 2.618033988749895 ✓

// Tau simplifies circle math: full rotation in radians
Math.sin(TAU); // ≈ 0 (one full revolution)
```
