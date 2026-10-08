import { isComplex, isUnit, typeOf } from '../../is.js';
import { factory } from '../../factory.js';
import { clone } from '../../object.js';
import { memoize, endsWith, hasOwnProperty, warnOnce } from '../../shared.js';
import { BIGNUMBER_PI } from '../bignumber.js';
import type {
  BaseUnitDef,
  BigNumberValue,
  ConverterFn,
  CreateUnitDefObject,
  CreateUnitOptions,
  FractionValue,
  Numeric,
  ParseOptions,
  PrefixDef,
  PrefixTable,
  TypeConverters,
  UnitComponent,
  UnitConfig,
  UnitConstructor,
  UnitDef,
  UnitDependencies,
  UnitFormatOptions,
  UnitInstance,
  UnitJSON,
  UnitSystem,
  UnitSystemEntry,
} from './unit-types.js';
import { DimensionMismatchError, UnitParseError } from './errors.js';
import {
  type ExactScale,
  addExactScales,
  binaryExactScale,
  divideExactScales,
  exactScaleOf,
  exactScaleToNumber,
  multiplyExactScales,
  powerExactScale,
  ratioExactScale,
  UNIT_EXACT_SCALE,
} from './exact-scale.js';
import {
  type UnitPrefix,
  type UnitPrefixSetKey,
  readUnitScale,
  UNIT_PREFIX_SETS,
  UNIT_ROW_ALIASES,
  UNIT_ROWS,
  unitPrefixExactScale,
} from './unit-table.js';

const UNIT_ZERO_SCALE: ExactScale = ratioExactScale(0);

/**
 * `scale_from × offset_from − scale_to × offset_to`: what converting between two
 * affine units adds to the offset-free value. Null unless both have exact scales.
 */
function exactOffsetShift(from: UnitDef, to: UnitDef): ExactScale | null {
  if (from.exact === undefined || to.exact === undefined) return null;
  return addExactScales(
    multiplyExactScales(from.exact, from.exactOffset ?? UNIT_ZERO_SCALE),
    multiplyExactScales(ratioExactScale(-1), to.exact, to.exactOffset ?? UNIT_ZERO_SCALE)
  );
}

/**
 * Give a unit definition its exact scale and offset. They are non-enumerable,
 * so a definition still copies and serialises as before (the unit systems are
 * JSON clones; a clone simply takes the float route).
 */
function attachExactScale(def: UnitDef, exact: ExactScale, exactOffset: ExactScale): void {
  Object.defineProperty(def, 'exact', {
    value: exact,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(def, 'exactOffset', {
    value: exactOffset,
    enumerable: false,
    writable: true,
    configurable: true,
  });
}

/** Exact prefix factors, read once from each prefix's decimal value. */
const prefixScales = new WeakMap<PrefixDef, ExactScale | null>();
function prefixExactScale(prefix: PrefixDef): ExactScale | null {
  let scale = prefixScales.get(prefix);
  if (scale === undefined) {
    scale = Number.isFinite(prefix.value) ? exactScaleOf(prefix.value) : null;
    prefixScales.set(prefix, scale);
  }
  return scale;
}

/**
 * Normalize degree-symbol unit notations to their ASCII spellings before parsing,
 * so the merged Unit accepts the inputs the old core Unit did (`°C`, `°F`, and a
 * bare `°` for angle). The mathjs parser treats `°` as an invalid character, so
 * this must run before tokenizing. Order matters: `°C`/`°F` before the bare `°`.
 */
function normalizeDegreeSymbols(s: string): string {
  return s.replace(/°C/g, 'degC').replace(/°F/g, 'degF').replace(/°/g, 'deg');
}

const name = 'Unit';
const dependencies = [
  '?on',
  'config',
  'addScalar',
  'subtractScalar',
  'multiplyScalar',
  'divideScalar',
  'pow',
  'abs',
  'fix',
  'round',
  'equal',
  'isNumeric',
  'format',
  'number',
  'Complex',
  'BigNumber',
  'Fraction',
];

export const createUnitClass = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    on,
    config,
    addScalar,
    subtractScalar,
    multiplyScalar,
    divideScalar,
    pow,
    abs,
    fix,
    round,
    equal,
    isNumeric,
    format,
    number,
    Complex,
    BigNumber,
    Fraction,
  }: UnitDependencies): UnitConstructor => {
    const toNumber = number;
    const fixPrefixDefault = false;
    const skipAutomaticSimplificationDefault = true;

    /**
     * A BigNumber from decimal text. A dependency set may hand the raw core class
     * (private constructor, static `parse`) or a constructor that takes a string.
     */
    function bigNumberFromText(text: string): BigNumberValue {
      const parse = (BigNumber as unknown as { parse?: (t: string) => BigNumberValue }).parse;
      return typeof parse === 'function'
        ? parse.call(BigNumber, text)
        : (new BigNumber(text) as unknown as BigNumberValue);
    }

    /** An exact scale as a BigNumber at the configured precision (π from BIGNUMBER_PI). */
    function exactToBigNumber(scale: ExactScale): Numeric {
      let v = bigNumberFromText(scale.num.toString()).div(bigNumberFromText(scale.den.toString()));
      const pi = BIGNUMBER_PI as unknown as BigNumberValue;
      for (let k = 0; k < Math.abs(scale.pi); k++) v = scale.pi > 0 ? v.times(pi) : v.div(pi);
      return v as unknown as Numeric;
    }

    /**
     * The reading a normalized number came from: of the doubles `r` near
     * `value / scale` whose decimal times `scale` rounds to `value`, the one with
     * the shortest decimal (nearest to `value / scale` on a tie). 273.15 K in
     * degR reads back as 491.67, not 491.66999999999996. Undefined when no
     * neighbour qualifies (then the caller keeps the normalized value as is).
     */
    function simplestReading(value: number, scale: ExactScale): number | undefined {
      if (value === 0) return undefined;
      const start = applyExactScale(value, scale, true);
      if (typeof start !== 'number' || !Number.isFinite(start) || start === 0) return undefined;
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, start);
      const bits = view.getBigInt64(0);
      let best: number | undefined;
      let bestLength = Infinity;
      for (const step of [0n, -1n, 1n, -2n, 2n, -3n, 3n, -4n, 4n]) {
        view.setBigInt64(0, bits + step);
        const r = view.getFloat64(0);
        if (!Number.isFinite(r) || Math.sign(r) !== Math.sign(start)) continue;
        if (exactScaleToNumber(multiplyExactScales(exactScaleOf(r), scale)) !== value) continue;
        const length = String(r).length;
        if (length < bestLength) {
          best = r;
          bestLength = length;
        }
      }
      return best;
    }

    /**
     * `value + shift` with one rounding, or undefined when the value's type has no
     * exact route. A number is first taken back to the reading it was normalized
     * from ({@link simplestReading}: `212` for 212 degF), read as that decimal and
     * scaled exactly, so the normalization's rounding does not reach the result:
     * 212 degF is 100 degC.
     */
    function addExactShift(
      unit: UnitInstance,
      value: Numeric,
      shift: ExactScale
    ): Numeric | undefined {
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) return undefined;
        let normalized = binaryExactScale(value);
        const scale = unit.exactScale();
        const reading = scale === null ? undefined : simplestReading(value, scale);
        if (reading !== undefined) normalized = multiplyExactScales(exactScaleOf(reading), scale!);
        const sum = addExactScales(normalized, shift);
        return sum === null ? undefined : exactScaleToNumber(sum);
      }
      const s = exactAs(shift, typeOf(value));
      return s === undefined ? undefined : addScalar(value, s);
    }

    /** An exact scale as a Fraction or a BigNumber, or undefined for another type (or a Fraction times π). */
    function exactAs(scale: ExactScale, type: string): Numeric | undefined {
      if (type === 'Fraction') {
        return scale.pi === 0
          ? (new Fraction(scale.num, scale.den) as unknown as Numeric)
          : undefined;
      }
      if (type === 'BigNumber') return exactToBigNumber(scale);
      return undefined;
    }

    /**
     * `value × scale` (normalize a reading) or `value / scale` (denormalize a
     * normalized value) with one rounding, or undefined when the value's type has
     * no exact route (Complex, a Fraction times π, ±0, a non-finite number); the
     * caller then takes the float route. A reading is the decimal it prints as, so
     * `72` in `mN/m` is 0.072 and `1` in `g/cm^3` is 1000. A normalized value is a
     * computed double, so it is taken at its exact binary value: 0 degC in degF
     * is 32, not 32.00000000000001.
     */
    function applyExactScale(
      value: Numeric,
      scale: ExactScale,
      divide: boolean
    ): Numeric | undefined {
      if (typeof value === 'number') {
        if (!Number.isFinite(value) || value === 0) return undefined;
        const x = divide ? binaryExactScale(value) : exactScaleOf(value);
        return exactScaleToNumber(
          divide ? divideExactScales(x, scale) : multiplyExactScales(x, scale)
        );
      }
      const factor = exactAs(scale, typeOf(value));
      if (factor === undefined) return undefined;
      return divide ? divideScalar(value, factor) : multiplyScalar(value, factor);
    }

    /**
     * A unit can be constructed in the following ways:
     *
     *     const a = new Unit(value, valuelessUnit)
     *     const b = new Unit(null, valuelessUnit)
     *     const c = Unit.parse(str)
     *
     * Example usage:
     *
     *     const a = new Unit(5, 'cm')               // 50 mm
     *     const b = Unit.parse('23 kg')             // 23 kg
     *     const c = math.in(a, new Unit(null, 'm')  // 0.05 m
     *     const d = new Unit(9.81, "m/s^2")         // 9.81 m/s^2
     *
     * @class Unit
     * @constructor Unit
     * @param value - Optional. A value like 5.2
     * @param valuelessUnit - A unit without value. Can have prefix, like "cm"
     */
    const Unit = function (
      this: UnitInstance,
      value?: Numeric | null,
      valuelessUnit?: string | UnitInstance
    ): void {
      if (!(this instanceof Unit)) {
        throw new Error('Constructor must be called with the new operator');
      }

      if (!(value === null || value === undefined || isNumeric(value) || isComplex(value))) {
        throw new TypeError(
          'First parameter in Unit constructor must be number, BigNumber, Fraction, Complex, or undefined'
        );
      }

      this.fixPrefix = fixPrefixDefault; // if true, function format will not search for the
      // best prefix but leave it as initially provided.
      // fixPrefix is set true by the method Unit.to

      // The justification behind this is that if the constructor is explicitly called,
      // the caller wishes the units to be returned exactly as supplied.
      this.skipAutomaticSimplification = skipAutomaticSimplificationDefault;

      if (valuelessUnit === undefined) {
        this.units = [];
        this.dimensions = BASE_DIMENSIONS.map((_x) => 0);
      } else if (typeof valuelessUnit === 'string') {
        const u = Unit.parse(valuelessUnit);
        this.units = u.units;
        this.dimensions = u.dimensions;
      } else if (isUnit(valuelessUnit) && valuelessUnit.value === null) {
        // clone from valuelessUnit
        this.fixPrefix = valuelessUnit.fixPrefix;
        this.skipAutomaticSimplification = valuelessUnit.skipAutomaticSimplification;
        this.dimensions = valuelessUnit.dimensions.slice(0);
        this.units = valuelessUnit.units.map((u) => Object.assign({}, u));
      } else {
        throw new TypeError(
          'Second parameter in Unit constructor must be a string or valueless Unit'
        );
      }

      this.value = this._normalize(value);
    } as unknown as UnitConstructor;

    /**
     * Attach type information
     */
    Object.defineProperty(Unit, 'name', { value: 'Unit' });
    Unit.prototype.constructor = Unit;
    Unit.prototype.type = 'Unit';
    Unit.prototype.isUnit = true;

    // private variables and functions for the Unit parser
    let text: string;
    let index: number;
    let c: string;

    function skipWhitespace(): void {
      while (c === ' ' || c === '\t') {
        next();
      }
    }

    function isDigitDot(c: string): boolean {
      return (c >= '0' && c <= '9') || c === '.';
    }

    function isDigit(c: string): boolean {
      return c >= '0' && c <= '9';
    }

    function next(): void {
      index++;
      c = text.charAt(index);
    }

    function revert(oldIndex: number): void {
      index = oldIndex;
      c = text.charAt(index);
    }

    function parseNumber(): string | null {
      let number = '';
      const oldIndex = index;

      if (c === '+') {
        next();
      } else if (c === '-') {
        number += c;
        next();
      }

      if (!isDigitDot(c)) {
        // a + or - must be followed by a digit
        revert(oldIndex);
        return null;
      }

      // get number, can have a single dot
      if (c === '.') {
        number += c;
        next();
        if (!isDigit(c)) {
          // this is no legal number, it is just a dot
          revert(oldIndex);
          return null;
        }
      } else {
        while (isDigit(c)) {
          number += c;
          next();
        }
        if (c === '.') {
          number += c;
          next();
        }
      }
      while (isDigit(c)) {
        number += c;
        next();
      }

      // check for exponential notation like "2.3e-4" or "1.23e50"
      if (c === 'E' || c === 'e') {
        // The grammar branches here. This could either be part of an exponent or the start of a unit that begins with the letter e, such as "4exabytes"

        let tentativeNumber = '';
        const tentativeIndex = index;

        tentativeNumber += c;
        next();

        // `next()` reassigns the closure cursor `c`; the casts restore its
        // `string` type (control-flow narrowing can't see the mutation).
        if ((c as string) === '+' || (c as string) === '-') {
          tentativeNumber += c;
          next();
        }

        // Scientific notation MUST be followed by an exponent (otherwise we assume it is not scientific notation)
        if (!isDigit(c)) {
          // The e or E must belong to something else, so return the number without the e or E.
          revert(tentativeIndex);
          return number;
        }

        // We can now safely say that this is scientific notation.
        number = number + tentativeNumber;
        while (isDigit(c)) {
          number += c;
          next();
        }
      }

      return number;
    }

    function parseUnit(): string | null {
      let unitName = '';

      // Alphanumeric characters only; matches [a-zA-Z0-9]
      while (isDigit(c) || Unit.isValidAlpha(c)) {
        unitName += c;
        next();
      }

      // Must begin with [a-zA-Z]
      const firstC = unitName.charAt(0);
      if (Unit.isValidAlpha(firstC)) {
        return unitName;
      } else {
        return null;
      }
    }

    function parseCharacter(toFind: string): string | null {
      if (c === toFind) {
        next();
        return toFind;
      } else {
        return null;
      }
    }

    /**
     * Parse a string into a unit. The value of the unit is parsed as number,
     * BigNumber, or Fraction depending on the math.js config setting `number`.
     *
     * Throws an exception if the provided string does not contain a valid unit or
     * cannot be parsed.
     * @memberof Unit
     * @param str - A string like "5.2 inch", "4e2 cm/s^2"
     * @return unit
     */
    Unit.parse = function (str: string, options?: ParseOptions): UnitInstance {
      options = options || {};

      if (typeof str !== 'string') {
        throw new TypeError('Invalid argument in Unit.parse, string expected');
      }

      text = normalizeDegreeSymbols(str);
      index = -1;
      c = '';

      const unit = new Unit();
      unit.units = [];

      let powerMultiplierCurrent: number = 1;
      let expectingUnit = false;

      // A unit should follow this pattern:
      // [number] ...[ [*/] unit[^number] ]
      // unit[^number] ... [ [*/] unit[^number] ]

      // Rules:
      // number is any floating point number.
      // unit is any alphanumeric string beginning with an alpha. Units with names like e3 should be avoided because they look like the exponent of a floating point number!
      // The string may optionally begin with a number.
      // Each unit may optionally be followed by ^number.
      // Whitespace or a forward slash is recommended between consecutive units, although the following technically is parseable:
      //   2m^2kg/s^2
      // it is not good form. If a unit starts with e, then it could be confused as a floating point number:
      //   4erg

      next();
      skipWhitespace();

      // Optional number at the start of the string
      const valueStr = parseNumber();
      let value: Numeric | null = null;
      if (valueStr) {
        if (config.number === 'BigNumber') {
          value = new BigNumber(valueStr);
        } else if (config.number === 'Fraction') {
          try {
            // not all numbers can be turned in Fractions, for example very small numbers not
            value = new Fraction(valueStr);
          } catch {
            value = parseFloat(valueStr);
          }
        } else {
          // number
          value = parseFloat(valueStr);
        }

        skipWhitespace(); // Whitespace is not required here

        // handle multiplication or division right after the value, like '1/s'
        if (parseCharacter('*')) {
          powerMultiplierCurrent = 1;
          expectingUnit = true;
        } else if (parseCharacter('/')) {
          powerMultiplierCurrent = -1;
          expectingUnit = true;
        }
      }

      // Stack to keep track of powerMultipliers applied to each parentheses group
      const powerMultiplierStack: number[] = [];

      // Running product of all elements in powerMultiplierStack
      let powerMultiplierStackProduct = 1;

      while (true) {
        skipWhitespace();

        // Check for and consume opening parentheses, pushing powerMultiplierCurrent to the stack
        // A '(' will always appear directly before a unit.
        while (c === '(') {
          powerMultiplierStack.push(powerMultiplierCurrent);
          powerMultiplierStackProduct *= powerMultiplierCurrent;
          powerMultiplierCurrent = 1;
          next();
          skipWhitespace();
        }

        // Is there something here?
        let uStr: string | null;
        if (c) {
          const oldC = c;
          uStr = parseUnit();
          if (uStr === null) {
            throw new UnitParseError(
              'Unexpected "' + oldC + '" in "' + text + '" at index ' + index.toString()
            );
          }
        } else {
          // End of input.
          break;
        }

        // Verify the unit exists and get the prefix (if any)
        const res = _findUnit(uStr) as { unit: UnitDef; prefix: PrefixDef } | null;
        if (res === null) {
          // Unit not found.
          throw new UnitParseError('Unit "' + uStr + '" not found.');
        }

        let power = powerMultiplierCurrent * powerMultiplierStackProduct;
        // Is there a "^ number"?
        skipWhitespace();
        if (parseCharacter('^')) {
          skipWhitespace();
          const p = parseNumber();
          if (p === null) {
            // No valid number found for the power!
            throw new UnitParseError(
              'In "' + str + '", "^" must be followed by a floating-point number'
            );
          }
          // `p` is the numeric string from parseNumber; `*=` coerces it to a
          // number exactly as before (cast is type-only, no runtime change).
          power *= p as unknown as number;
        }

        // Add the unit to the list
        unit.units.push({
          unit: res.unit,
          prefix: res.prefix,
          power,
        });
        for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
          unit.dimensions[i] += (res.unit.dimensions?.[i] || 0) * power;
        }

        // Check for and consume closing parentheses, popping from the stack.
        // A ')' will always follow a unit.
        skipWhitespace();
        while (c === ')') {
          if (powerMultiplierStack.length === 0) {
            throw new UnitParseError(
              'Unmatched ")" in "' + text + '" at index ' + index.toString()
            );
          }
          powerMultiplierStackProduct /= powerMultiplierStack.pop()!;
          next();
          skipWhitespace();
        }

        // "*" and "/" should mean we are expecting something to come next.
        // Is there a forward slash? If so, negate powerMultiplierCurrent. The next unit or paren group is in the denominator.
        expectingUnit = false;

        if (parseCharacter('*')) {
          // explicit multiplication
          powerMultiplierCurrent = 1;
          expectingUnit = true;
        } else if (parseCharacter('/')) {
          // division
          powerMultiplierCurrent = -1;
          expectingUnit = true;
        } else {
          // implicit multiplication
          powerMultiplierCurrent = 1;
        }

        // Replace the unit into the auto unit system
        if (res.unit.base) {
          const baseDim = res.unit.base.key!;
          UNIT_SYSTEMS.auto[baseDim] = {
            unit: res.unit,
            prefix: res.prefix,
          };
        }
      }

      // Has the string been entirely consumed?
      skipWhitespace();
      if (c) {
        throw new UnitParseError('Could not parse: "' + str + '"');
      }

      // Is there a trailing slash?
      if (expectingUnit) {
        throw new UnitParseError('Trailing characters: "' + str + '"');
      }

      // Is the parentheses stack empty?
      if (powerMultiplierStack.length !== 0) {
        throw new UnitParseError('Unmatched "(" in "' + text + '"');
      }

      // Are there any units at all?
      if (unit.units.length === 0 && !options.allowNoUnits) {
        throw new UnitParseError('"' + str + '" contains no units');
      }

      unit.value = value !== undefined ? unit._normalize(value) : null;
      return unit;
    };

    /**
     * create a copy of this unit
     * @memberof Unit
     * @return Returns a cloned version of the unit
     */
    Unit.prototype.clone = function (this: UnitInstance): UnitInstance {
      const unit = new Unit();

      unit.fixPrefix = this.fixPrefix;
      unit.skipAutomaticSimplification = this.skipAutomaticSimplification;

      unit.value = clone(this.value);
      unit.dimensions = this.dimensions.slice(0);
      unit.units = [];
      for (let i = 0; i < this.units.length; i++) {
        unit.units[i] = {} as UnitComponent;
        const target = unit.units[i] as unknown as Record<string, unknown>;
        const source = this.units[i] as unknown as Record<string, unknown>;
        for (const p in source) {
          if (hasOwnProperty(source, p)) {
            target[p] = source[p];
          }
        }
      }

      return unit;
    };

    /**
     * Return the type of the value of this unit
     *
     * @memberof Unit
     * @return type of the value of the unit
     */
    Unit.prototype.valueType = function (this: UnitInstance): string {
      return typeOf(this.value);
    };

    /**
     * Return whether the unit is derived (such as m/s, or cm^2, but not N)
     * @memberof Unit
     * @return True if the unit is derived
     * @private
     */
    Unit.prototype._isDerived = function (this: UnitInstance): boolean {
      if (this.units.length === 0) {
        return false;
      }
      return this.units.length > 1 || Math.abs(this.units[0].power - 1.0) > 1e-15;
    };

    /**
     * The exact SI scale of this unit's unit list: every component's exact unit
     * scale times its prefix, raised to its power. Null when a component has no
     * exact scale (a unit made with `createUnit`, VAR) or a non-integer power.
     * @memberof Unit
     * @return The exact scale, or null
     */
    Unit.prototype.exactScale = function (this: UnitInstance): ExactScale | null {
      let scale = UNIT_EXACT_SCALE;
      for (const component of this.units) {
        const unitScale = component.unit.exact;
        const prefixScale = prefixExactScale(component.prefix);
        if (unitScale === undefined || prefixScale === null || !Number.isInteger(component.power)) {
          return null;
        }
        scale = multiplyExactScales(
          scale,
          powerExactScale(multiplyExactScales(unitScale, prefixScale), component.power)
        );
      }
      return scale;
    };

    /**
     * The exact SI scale of a valueless unit text (`'g/cm^3'` is 1000, `'psi'` is
     * 0.45359237 × 9.80665 / 0.0254²), or null when it has none (see
     * {@link Unit.prototype.exactScale}).
     * @memberof Unit
     */
    Unit.exactScale = function (valuelessUnit: string): ExactScale | null {
      return Unit.parse(valuelessUnit).exactScale();
    };

    /**
     * Normalize a value, based on its currently set unit(s)
     * @memberof Unit
     * @param value
     * @return normalized value
     * @private
     */
    Unit.prototype._normalize = function (
      this: UnitInstance,
      value: Numeric | null | undefined
    ): Numeric | null {
      if (value === null || value === undefined || this.units.length === 0) {
        return value ?? null;
      }
      const scale = this.exactScale();
      if (scale !== null) {
        const exact = applyExactScale(value, scale, false);
        if (exact !== undefined) return exact;
      }
      let res: Numeric = value;
      const convert = Unit._getNumberConverter(typeOf(value)); // convert to Fraction or BigNumber if needed

      for (let i = 0; i < this.units.length; i++) {
        const unitValue = convert(this.units[i].unit.value!);
        const unitPrefixValue = convert(this.units[i].prefix.value);
        const unitPower = convert(this.units[i].power);
        res = multiplyScalar(res, pow(multiplyScalar(unitValue, unitPrefixValue), unitPower));
      }

      return res;
    };

    /**
     * Denormalize a value, based on its currently set unit(s)
     * @memberof Unit
     * @param value
     * @param prefixValue - Optional prefix value to be used (ignored if this is a derived unit)
     * @return denormalized value
     * @private
     */
    Unit.prototype._denormalize = function (
      this: UnitInstance,
      value: Numeric | null,
      _prefixValue?: Numeric
    ): Numeric | null {
      if (value === null || value === undefined || this.units.length === 0) {
        return value ?? null;
      }
      const scale = this.exactScale();
      if (scale !== null) {
        const exact = applyExactScale(value, scale, true);
        if (exact !== undefined) return exact;
      }
      let res: Numeric = value;
      const convert = Unit._getNumberConverter(typeOf(value)); // convert to Fraction or BigNumber if needed

      for (let i = 0; i < this.units.length; i++) {
        const unitValue = convert(this.units[i].unit.value!);
        const unitPrefixValue = convert(this.units[i].prefix.value);
        const unitPower = convert(this.units[i].power);
        res = divideScalar(res, pow(multiplyScalar(unitValue, unitPrefixValue), unitPower));
      }

      return res;
    };

    /**
     * Find a unit from a string
     * @memberof Unit
     * @param str - A string like 'cm' or 'inch'
     * @returns result  When found, an object with fields unit and
     *                                  prefix is returned. Else, null is returned.
     * @private
     */
    const _findUnit = memoize(
      (...args: unknown[]): { unit: UnitDef; prefix: PrefixDef } | null => {
        const str = args[0] as string;
        // First, match units names exactly. For example, a user could define 'mm' as 10^-4 m, which is silly, but then we would want 'mm' to match the user-defined unit.
        if (hasOwnProperty(UNITS, str)) {
          const unit = UNITS[str];
          const prefix = unit.prefixes![''];
          return { unit, prefix };
        }

        for (const name in UNITS) {
          if (hasOwnProperty(UNITS, name)) {
            if (endsWith(str, name)) {
              const unit = UNITS[name];
              const prefixLen = str.length - name.length;
              const prefixName = str.substring(0, prefixLen);
              const prefix = hasOwnProperty(unit.prefixes, prefixName)
                ? unit.prefixes![prefixName]
                : undefined;
              if (prefix !== undefined) {
                // store unit, prefix, and value
                return { unit, prefix };
              }
            }
          }
        }

        return null;
      },
      { hasher: (args: unknown[]): string => args[0] as string, limit: 100 }
    );

    /**
     * Test if the given expression is a unit.
     * The unit can have a prefix but cannot have a value.
     * @memberof Unit
     * @param name - A string to be tested whether it is a value less unit.
     *                        The unit can have prefix, like "cm"
     * @return true if the given string is a unit
     */
    Unit.isValuelessUnit = function (name: string): boolean {
      return _findUnit(name) !== null;
    };

    /**
     * check if this unit has given base unit
     * If this unit is a derived unit, this will ALWAYS return false, since by definition base units are not derived.
     * @memberof Unit
     * @param base
     */
    Unit.prototype.hasBase = function (
      this: UnitInstance,
      base: BaseUnitDef | string | undefined
    ): boolean {
      if (typeof base === 'string') {
        base = BASE_UNITS[base];
      }

      if (!base) {
        return false;
      }

      // All dimensions must be the same
      for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
        if (Math.abs((this.dimensions[i] || 0) - (base.dimensions[i] || 0)) > 1e-12) {
          return false;
        }
      }
      return true;
    };

    /**
     * Check if this unit has a base or bases equal to another base or bases
     * For derived units, the exponent on each base also must match
     * @memberof Unit
     * @param other
     * @return true if equal base
     */
    Unit.prototype.equalBase = function (
      this: UnitInstance,
      other: { dimensions: number[] }
    ): boolean {
      // All dimensions must be the same
      for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
        if (Math.abs((this.dimensions[i] || 0) - (other.dimensions[i] || 0)) > 1e-12) {
          return false;
        }
      }
      return true;
    };

    /**
     * Check if this unit equals another unit
     * @memberof Unit
     * @param other
     * @return true if both units are equal
     */
    Unit.prototype.equals = function (this: UnitInstance, other: UnitInstance): boolean {
      return this.equalBase(other) && equal(this.value, other.value);
    };

    /**
     * Multiply this unit with another one or with a scalar
     * @memberof Unit
     * @param other
     * @return product of this unit and the other unit
     */
    Unit.prototype.multiply = function (
      this: UnitInstance,
      _other: UnitInstance | Numeric
    ): UnitInstance | Numeric {
      const res = this.clone();
      const other = isUnit(_other) ? _other : new Unit(_other);

      for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
        // Dimensions arrays may be of different lengths. Default to 0.
        res.dimensions[i] = (this.dimensions[i] || 0) + (other.dimensions[i] || 0);
      }

      // Append other's units list onto res
      for (let i = 0; i < other.units.length; i++) {
        // Make a shallow copy of every unit
        const inverted = {
          ...other.units[i],
        };
        res.units.push(inverted);
      }

      // If at least one operand has a value, then the result should also have a value
      if (this.value !== null || other.value !== null) {
        // At least one operand is non-null here, so both branches yield a
        // non-null numeric (the `one(...)` fallback always produces a value).
        const valThis = this.value === null ? this._normalize(one(other.value)) : this.value;
        const valOther = other.value === null ? other._normalize(one(this.value)) : other.value;

        res.value = multiplyScalar(valThis!, valOther!);
      } else {
        res.value = null;
      }

      if (isUnit(_other)) {
        res.skipAutomaticSimplification = false;
      }

      // Simplify units (cancel common units, reduce powers)
      if (!res.skipAutomaticSimplification) {
        simplifyUnit(res);
      }

      return getNumericIfUnitless(res);
    };

    /**
     * Divide a number by this unit
     *
     * @memberof Unit
     * @param numerator
     * @returns The result of dividing numerator by this unit
     */
    Unit.prototype.divideInto = function (
      this: UnitInstance,
      numerator: Numeric
    ): UnitInstance | Numeric {
      return new Unit(numerator).divide(this);
    };

    /**
     * Divide this unit by another one
     * @memberof Unit
     * @param other
     * @return result of dividing this unit by the other unit
     */
    Unit.prototype.divide = function (
      this: UnitInstance,
      _other: UnitInstance | Numeric
    ): UnitInstance | Numeric {
      const res = this.clone();
      const other = isUnit(_other) ? _other : new Unit(_other);

      for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
        // Dimensions arrays may be of different lengths. Default to 0.
        res.dimensions[i] = (this.dimensions[i] || 0) - (other.dimensions[i] || 0);
      }

      // Invert and append other's units list onto res
      for (let i = 0; i < other.units.length; i++) {
        // Make a shallow copy of every unit
        const inverted = {
          ...other.units[i],
          power: -other.units[i].power,
        };
        res.units.push(inverted);
      }

      // If at least one operand has a value, the result should have a value
      if (this.value !== null || other.value !== null) {
        // At least one operand is non-null here, so both branches yield a
        // non-null numeric (the `one(...)` fallback always produces a value).
        const valThis = this.value === null ? this._normalize(one(other.value)) : this.value;
        const valOther = other.value === null ? other._normalize(one(this.value)) : other.value;
        res.value = divideScalar(valThis!, valOther!);
      } else {
        res.value = null;
      }

      if (isUnit(_other)) {
        res.skipAutomaticSimplification = false;
      }

      // Simplify units (cancel common units, reduce powers)
      if (!res.skipAutomaticSimplification) {
        simplifyUnit(res);
      }

      return getNumericIfUnitless(res);
    };

    /**
     * Calculate the power of a unit
     * @memberof Unit
     * @param p
     * @returns The result: this^p
     */
    Unit.prototype.pow = function (this: UnitInstance, p: number): UnitInstance | Numeric {
      const res = this.clone();

      for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
        // Dimensions arrays may be of different lengths. Default to 0.
        res.dimensions[i] = (this.dimensions[i] || 0) * p;
      }

      // Adjust the power of each unit in the list
      for (let i = 0; i < res.units.length; i++) {
        res.units[i].power *= p;
      }

      if (res.value !== null) {
        res.value = pow(res.value, p);

        // only allow numeric output, we don't want to return a Complex number
        // if (!isNumeric(res.value)) {
        //  res.value = NaN
        // }
        // Update: Complex supported now
      } else {
        res.value = null;
      }

      res.skipAutomaticSimplification = false;

      return getNumericIfUnitless(res);
    };

    /**
     * Return the numeric value of this unit if it is dimensionless, has a value, and config.predictable == false; or the original unit otherwise
     * @param unit
     * @returns The numeric value of the unit if conditions are met, or the original unit otherwise
     */
    function getNumericIfUnitless(unit: UnitInstance): UnitInstance | Numeric {
      if (unit.equalBase(BASE_UNITS.NONE) && unit.value !== null && !config.predictable) {
        return unit.value;
      } else {
        return unit;
      }
    }

    /**
     * Normalize unit name to handle aliases.
     * Examples: 'meter' → 'm', 'meters' → 'm', 'gram' → 'g'
     * @param name - Unit name
     * @returns Normalized name
     * @private
     */
    function normalizeUnitName(name: string): string {
      const lower = name.toLowerCase();

      const aliasMap: Record<string, string> = {
        // Length
        meter: 'm',
        meters: 'm',
        metre: 'm',
        metres: 'm',

        // Mass
        gram: 'g',
        grams: 'g',
        kilogram: 'kg',
        kilograms: 'kg',

        // Time
        second: 's',
        seconds: 's',

        // Temperature
        kelvin: 'K',
        kelvins: 'K',
        celsius: 'degC',

        // Frequency
        hertz: 'Hz',

        // Force
        newton: 'N',
        newtons: 'N',

        // Energy
        joule: 'J',
        joules: 'J',

        // Power
        watt: 'W',
        watts: 'W',
      };

      return aliasMap[lower] || lower;
    }

    /**
     * Create a unique key for grouping identical units.
     * Combines normalized unit name with prefix name.
     * @param unitObj - Unit object with unit and prefix properties
     * @returns Normalized key for grouping
     * @private
     */
    function normalizeUnitKey(unitObj: UnitComponent): string {
      const normalizedName = normalizeUnitName(unitObj.unit.name);
      const prefixName = unitObj.prefix ? unitObj.prefix.name : '';
      return `${normalizedName}_${prefixName}`;
    }

    /**
     * Cancel matching units between numerator and denominator.
     *
     * Only cancels units with opposite powers (e.g., m^1 and m^-1).
     * Does NOT consolidate multiple units in the same category.
     * Preserves original order of units.
     *
     * Examples:
     *   J/K/g * g → J/K (g^1 cancels with g^-1)
     *   m^2 / m → m (one m cancels, leaving m^1)
     *   m / m → dimensionless (complete cancellation)
     *   lbf / (in * in) → lbf / in / in (in units NOT consolidated)
     *
     * @param unit - The unit to simplify
     * @returns The simplified unit
     * @private
     */
    function simplifyUnit(unit: UnitInstance): UnitInstance {
      let units = unit.units;

      // Simple case: 0 or 1 unit components need no simplification
      if (!units || units.length <= 1) {
        return unit;
      }

      // Copy units array to avoid modifying during iteration
      units = units.map((u) => ({ ...u }));

      // Cancel matching units with opposite powers
      // For each positive power unit, look for matching negative power unit
      for (let i = 0; i < units.length; i++) {
        if (units[i].power > 0) {
          const key1 = normalizeUnitKey(units[i]);

          // Search entire array for matching unit with negative power
          for (let j = 0; j < units.length; j++) {
            if (j !== i && units[j].power < 0) {
              const key2 = normalizeUnitKey(units[j]);

              if (key1 === key2) {
                // Found matching units - calculate cancellation
                const positivePower = units[i].power;
                const negativePower = Math.abs(units[j].power);
                const cancelAmount = Math.min(positivePower, negativePower);

                // Reduce powers
                units[i].power -= cancelAmount;
                units[j].power += cancelAmount; // Adding because it's negative

                break; // Only cancel with first match
              }
            }
          }
        }
      }

      // Remove units with zero power
      const simplifiedUnits = units.filter((u) => Math.abs(u.power) >= 1e-12);

      // Update unit's units array
      unit.units = simplifiedUnits;
      return unit;
    }

    /**
     * Create a value one with the numeric type of `typeOfValue`.
     * For example, `one(new BigNumber(3))` returns `BigNumber(1)`
     * @param typeOfValue
     * @returns
     */
    function one(typeOfValue: Numeric | null): Numeric {
      // TODO: this is a workaround to prevent the following BigNumber conversion error from throwing:
      //  "TypeError: Cannot implicitly convert a number with >15 significant digits to BigNumber"
      //  see https://github.com/josdejong/mathjs/issues/3450
      //      https://github.com/josdejong/mathjs/pull/3375
      const convert = Unit._getNumberConverter(typeOf(typeOfValue));

      return convert(1);
    }

    /**
     * Calculate the absolute value of a unit
     * @memberof Unit
     * @param x
     * @returns The result: |x|, absolute value of x
     */
    Unit.prototype.abs = function (this: UnitInstance): UnitInstance {
      const ret = this.clone();
      if (ret.value !== null) {
        if (ret._isDerived() || ret.units.length === 0 || ret.units[0].unit.offset === 0) {
          ret.value = abs(ret.value);
        } else {
          // To give the correct, but unexpected, results for units with an offset.
          // For example, abs(-283.15 degC) = -263.15 degC !!!
          // We must take the offset into consideration here
          const convert = ret._numberConverter(); // convert to Fraction or BigNumber if needed
          const def = ret.units[0].unit;
          const exactOffset =
            def.exact === undefined
              ? undefined
              : multiplyExactScales(def.exact, def.exactOffset ?? UNIT_ZERO_SCALE);
          const valueType = typeOf(ret.value);
          const unitOffset =
            exactOffset === undefined
              ? multiplyScalar(convert(def.value!), convert(def.offset))
              : valueType === 'number'
                ? exactScaleToNumber(exactOffset)
                : (exactAs(exactOffset, valueType) ??
                  multiplyScalar(convert(def.value!), convert(def.offset)));
          ret.value = subtractScalar(abs(addScalar(ret.value, unitOffset)), unitOffset);
        }
      }

      for (const i in ret.units) {
        const comp = ret.units[i as unknown as number];
        if (comp.unit.name === 'VA' || comp.unit.name === 'VAR') {
          comp.unit = UNITS.W;
        }
      }

      return ret;
    };

    /**
     * Convert the unit to a specific unit name.
     * @memberof Unit
     * @param valuelessUnit - A unit without value. Can have prefix, like "cm"
     * @returns Returns a clone of the unit with a fixed prefix and unit.
     */
    Unit.prototype.to = function (
      this: UnitInstance,
      valuelessUnit: string | UnitInstance
    ): UnitInstance {
      const value = this.value === null ? this._normalize(1) : this.value;
      let other: UnitInstance;
      if (typeof valuelessUnit === 'string') {
        other = Unit.parse(valuelessUnit);
      } else if (isUnit(valuelessUnit)) {
        other = valuelessUnit.clone();
      } else {
        throw new Error('String or Unit expected as parameter');
      }

      if (!this.equalBase(other)) {
        throw new DimensionMismatchError(
          `Units do not match ('${other.toString()}' != '${this.toString()}')`
        );
      }
      if (other.value !== null) {
        throw new Error('Cannot convert to a unit with a value');
      }

      if (
        this.value === null ||
        this._isDerived() ||
        this.units.length === 0 ||
        other.units.length === 0 ||
        this.units[0].unit.offset === other.units[0].unit.offset
      ) {
        other.value = clone(value);
      } else {
        /* Need to adjust value by difference in offset to convert */
        // With exact scales on both units: value + scale_from × offset_from −
        // scale_to × offset_to, the shift exact and the sum rounded once.
        const shift = exactOffsetShift(this.units[0].unit, other.units[0].unit);
        const shifted = shift === null ? undefined : addExactShift(this, value!, shift);
        if (shifted !== undefined) {
          other.value = shifted;
          other.fixPrefix = true;
          other.skipAutomaticSimplification = true;
          return other;
        }
        const convert = Unit._getNumberConverter(typeOf(value)); // convert to Fraction or BigNumber if needed

        const thisUnitValue = this.units[0].unit.value!;
        const thisNominalOffset = this.units[0].unit.offset;
        const thisUnitOffset = multiplyScalar(thisUnitValue, thisNominalOffset);

        const otherUnitValue = other.units[0].unit.value!;
        const otherNominalOffset = other.units[0].unit.offset;
        const otherUnitOffset = multiplyScalar(otherUnitValue, otherNominalOffset);

        // `value` is non-null in this branch (the `this.value === null` case is
        // handled by the clone branch above).
        other.value = addScalar(value!, convert(subtractScalar(thisUnitOffset, otherUnitOffset)));
      }
      other.fixPrefix = true;
      other.skipAutomaticSimplification = true;
      return other;
    };

    /**
     * Return the value of the unit when represented with given valueless unit
     * @memberof Unit
     * @param valuelessUnit - For example 'cm' or 'inch'
     * @return Returns the unit value as number.
     * @deprecated Use Unit.toNumeric instead.
     */
    Unit.prototype.toNumber = function (
      this: UnitInstance,
      valuelessUnit?: string | UnitInstance
    ): number {
      warnOnce('Unit.toNumber is deprecated. Use Unit.toNumeric instead.');
      return toNumber(this.toNumeric(valuelessUnit));
    };

    /**
     * Return the value of the unit in the original numeric type
     * @memberof Unit
     * @param valuelessUnit - For example 'cm' or 'inch'
     * @return Returns the unit value
     */
    Unit.prototype.toNumeric = function (
      this: UnitInstance,
      valuelessUnit?: string | UnitInstance
    ): Numeric | null {
      let other: UnitInstance;
      if (valuelessUnit) {
        // Allow getting the numeric value without converting to a different unit
        other = this.to(valuelessUnit);
      } else {
        other = this.clone();
      }

      if (other._isDerived() || other.units.length === 0) {
        return other._denormalize(other.value);
      } else {
        return other._denormalize(other.value, other.units[0].prefix.value);
      }
    };

    /**
     * Get a string representation of the unit.
     * @memberof Unit
     * @return
     */
    Unit.prototype.toString = function (this: UnitInstance): string {
      return this.format();
    };

    /**
     * Get a JSON representation of the unit
     * @memberof Unit
     * @returns Returns a JSON object structured as:
     *                   `{"mathjs": "Unit", "value": 2, "unit": "cm", "fixPrefix": false, "skipSimp": true}`
     */
    Unit.prototype.toJSON = function (this: UnitInstance): UnitJSON {
      return {
        mathjs: 'Unit',
        value: this._denormalize(this.value),
        unit: this.units.length > 0 ? this.formatUnits() : null,
        fixPrefix: this.fixPrefix,
        skipSimp: this.skipAutomaticSimplification,
      };
    };

    /**
     * Instantiate a Unit from a JSON object
     * @memberof Unit
     * @param json - A JSON object structured as:
     *                       `{"mathjs": "Unit", "value": 2, "unit": "cm", "fixPrefix": false}`
     * @return
     */
    Unit.fromJSON = function (json: UnitJSON): UnitInstance {
      // Accept BOTH envelopes: the mathjs `{ mathjs, value, unit, fixPrefix, skipSimp }`
      // and the old core `{ mathts, value, notation }` — so units serialized by either
      // predecessor rehydrate without loss.
      const legacy = json as { notation?: string };
      const unitStr = json.unit ?? legacy.notation ?? undefined;
      const unit = new Unit(json.value, unitStr);
      unit.fixPrefix = json.fixPrefix ?? fixPrefixDefault;
      unit.skipAutomaticSimplification = json.skipSimp ?? skipAutomaticSimplificationDefault;
      return unit;
    };

    /**
     * Returns the string representation of the unit.
     * @memberof Unit
     * @return
     */
    Unit.prototype.valueOf = Unit.prototype.toString;

    /**
     * Simplify this Unit's unit list and return a new Unit with the simplified list.
     * The returned Unit will contain a list of the "best" units for formatting.
     */
    Unit.prototype.simplify = function (this: UnitInstance): UnitInstance {
      const ret = this.clone();

      const proposedUnitList: UnitComponent[] = [];

      // Search for a matching base
      let matchingBase: string | undefined;
      for (const key in currentUnitSystem) {
        if (hasOwnProperty(currentUnitSystem, key)) {
          if (ret.hasBase(BASE_UNITS[key])) {
            matchingBase = key;
            break;
          }
        }
      }

      if (matchingBase === 'NONE') {
        ret.units = [];
      } else {
        let matchingUnit: UnitSystemEntry | undefined;
        if (matchingBase) {
          // Does the unit system have a matching unit?
          if (hasOwnProperty(currentUnitSystem, matchingBase)) {
            matchingUnit = currentUnitSystem[matchingBase];
          }
        }
        if (matchingUnit) {
          ret.units = [
            {
              unit: matchingUnit.unit,
              prefix: matchingUnit.prefix,
              power: 1.0,
            },
          ];
        } else {
          // Multiple units or units with powers are formatted like this:
          // 5 (kg m^2) / (s^3 mol)
          // Build an representation from the base units of the current unit system
          let missingBaseDim = false;
          for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
            const baseDim = BASE_DIMENSIONS[i];
            if (Math.abs(ret.dimensions[i] || 0) > 1e-12) {
              if (hasOwnProperty(currentUnitSystem, baseDim)) {
                proposedUnitList.push({
                  unit: currentUnitSystem[baseDim].unit,
                  prefix: currentUnitSystem[baseDim].prefix,
                  power: ret.dimensions[i] || 0,
                });
              } else {
                missingBaseDim = true;
              }
            }
          }

          // Is the proposed unit list "simpler" than the existing one?
          if (proposedUnitList.length < ret.units.length && !missingBaseDim) {
            // Replace this unit list with the proposed list
            ret.units = proposedUnitList;
          }
        }
      }

      return ret;
    };

    /**
     * Returns a new Unit in the SI system with the same value as this one
     */
    Unit.prototype.toSI = function (this: UnitInstance): UnitInstance {
      const ret = this.clone();

      const proposedUnitList: UnitComponent[] = [];

      // Multiple units or units with powers are formatted like this:
      // 5 (kg m^2) / (s^3 mol)
      // Build an representation from the base units of the SI unit system
      for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
        const baseDim = BASE_DIMENSIONS[i];
        if (Math.abs(ret.dimensions[i] || 0) > 1e-12) {
          if (hasOwnProperty(UNIT_SYSTEMS.si, baseDim)) {
            proposedUnitList.push({
              unit: UNIT_SYSTEMS.si[baseDim].unit,
              prefix: UNIT_SYSTEMS.si[baseDim].prefix,
              power: ret.dimensions[i] || 0,
            });
          } else {
            throw new Error('Cannot express custom unit ' + baseDim + ' in SI units');
          }
        }
      }

      // Replace this unit list with the proposed list
      ret.units = proposedUnitList;

      ret.fixPrefix = true;
      ret.skipAutomaticSimplification = true;

      if (this.value !== null) {
        ret.value = null;
        return this.to(ret);
      }
      return ret;
    };

    /**
     * Get a string representation of the units of this Unit, without the value. The unit list is formatted as-is without first being simplified.
     * @memberof Unit
     * @return
     */
    Unit.prototype.formatUnits = function (this: UnitInstance): string {
      let strNum = '';
      let strDen = '';
      let nNum = 0;
      let nDen = 0;

      for (let i = 0; i < this.units.length; i++) {
        if (this.units[i].power > 0) {
          nNum++;
          strNum += ' ' + this.units[i].prefix.name + this.units[i].unit.name;
          if (Math.abs(this.units[i].power - 1.0) > 1e-15) {
            strNum += '^' + this.units[i].power;
          }
        } else if (this.units[i].power < 0) {
          nDen++;
        }
      }

      if (nDen > 0) {
        for (let i = 0; i < this.units.length; i++) {
          if (this.units[i].power < 0) {
            if (nNum > 0) {
              strDen += ' ' + this.units[i].prefix.name + this.units[i].unit.name;
              if (Math.abs(this.units[i].power + 1.0) > 1e-15) {
                strDen += '^' + -this.units[i].power;
              }
            } else {
              strDen += ' ' + this.units[i].prefix.name + this.units[i].unit.name;
              strDen += '^' + this.units[i].power;
            }
          }
        }
      }
      // Remove leading " "
      strNum = strNum.substr(1);
      strDen = strDen.substr(1);

      // Add parans for better copy/paste back into evaluate, for example, or for better pretty print formatting
      if (nNum > 1 && nDen > 0) {
        strNum = '(' + strNum + ')';
      }
      if (nDen > 1 && nNum > 0) {
        strDen = '(' + strDen + ')';
      }

      let str = strNum;
      if (nNum > 0 && nDen > 0) {
        str += ' / ';
      }
      str += strDen;

      return str;
    };

    /**
     * Get a unit, with optional formatting options.
     * @memberof Unit
     * @param units - Optional. Array of units strings or valueLess Unit objects in wich choose the best one
     * @param options - Optional. Options for parsing the unit. See parseUnit for details.
     *
     * @return Returns a new Unit with the given value and unit.
     */
    Unit.prototype.toBest = function (
      this: UnitInstance,
      unitList: Array<string | UnitInstance> = [],
      options: UnitFormatOptions = {}
    ): UnitInstance {
      // Default the best-prefix offset to 0 → pure |log10(displayed)|-minimization,
      // giving clean results (0.1 mm, 1 kg; no float noise), preserving the old core
      // Unit's toBest behavior. `format()` keeps the mathjs 1.2 engineering offset, so
      // only the EXPLICIT toBest picks this cleaner prefix. Caller can still override.
      options = { offset: 0, ...options };
      if (unitList && !Array.isArray(unitList)) {
        throw new Error('Invalid unit type. Expected string or Unit.');
      }

      const startPrefixes = this.units[0].unit.prefixes;
      if (unitList && unitList.length > 0) {
        const unitObjects = unitList.map((u) => {
          let unit: UnitInstance | null = null;
          if (typeof u === 'string') {
            unit = Unit.parse(u);
            if (!unit) {
              throw new Error('Invalid unit type. Expected compatible string or Unit.');
            }
          } else if (!isUnit(u)) {
            throw new Error('Invalid unit type. Expected compatible string or Unit.');
          }
          if (unit === null) {
            // `u` is a Unit here (the string and non-Unit cases are handled above).
            unit = (u as UnitInstance).clone();
          }
          try {
            this.to(unit.formatUnits());
            return unit;
          } catch {
            throw new Error('Invalid unit type. Expected compatible string or Unit.');
          }
        });
        const prefixes = unitObjects.map((el) => el.units[0].prefix);
        this.units[0].unit.prefixes = prefixes.reduce<PrefixTable>((acc, prefix) => {
          acc[prefix.name] = prefix;
          return acc;
        }, {});
        this.units[0].prefix = prefixes[0];
      }

      const result = formatBest(this, options).simp;
      this.units[0].unit.prefixes = startPrefixes;
      result.fixPrefix = true;
      return result;
    };
    /**
     * Get a string representation of the Unit, with optional formatting options.
     * @memberof Unit
     * @param options - Optional. Formatting options. See
     *                                                lib/utils/number:format for a
     *                                                description of the available
     *                                                options.
     * @return
     */
    Unit.prototype.format = function (this: UnitInstance, options?: UnitFormatOptions): string {
      const { simp, valueStr, unitStr } = formatBest(this, options);
      let str = valueStr;
      if (simp.value && isComplex(simp.value)) {
        str = '(' + str + ')'; // Surround complex values with ( ) to enable better parsing
      }
      if (unitStr.length > 0 && str.length > 0) {
        str += ' ';
      }
      str += unitStr;

      return str;
    };

    /**
     * Helper function to normalize a unit for conversion and formatting
     * @param unit - The unit to be normalized
     * @return Object with normalized unit and value
     * @private
     */
    function formatBest(
      unit: UnitInstance,
      options: UnitFormatOptions = {}
    ): { simp: UnitInstance; valueStr: string; unitStr: string } {
      // Simplfy the unit list, unless it is valueless or was created directly in the
      // constructor or as the result of to or toSI
      const simp =
        unit.skipAutomaticSimplification || unit.value === null ? unit.clone() : unit.simplify();

      // Apply some custom logic for handling VA and VAR. The goal is to express the value of the unit as a real value, if possible. Otherwise, use a real-valued unit instead of a complex-valued one.
      handleVAandVARUnits(simp);
      // Now apply the best prefix
      // Units must have only one unit and not have the fixPrefix flag set
      applyBestPrefixIfNeeded(simp, options.offset);

      const value = simp._denormalize(simp.value);
      const valueStr = simp.value !== null ? format(value, options || {}) : '';
      const unitStr = simp.formatUnits();
      return {
        simp,
        valueStr,
        unitStr,
      };
    }

    /**
     * Helper to handle VA and VAR units
     * @param simp - The unit to be normalized
     */
    function handleVAandVARUnits(simp: UnitInstance): void {
      let isImaginary = false;
      if (typeof simp.value !== 'undefined' && simp.value !== null && isComplex(simp.value)) {
        // TODO: Make this better, for example, use relative magnitude of re and im rather than absolute
        isImaginary = Math.abs(simp.value.re) < 1e-14;
      }
      for (const i in simp.units) {
        if (hasOwnProperty(simp.units, i)) {
          const comp = simp.units[i as unknown as number];
          if (comp.unit) {
            if (comp.unit.name === 'VA' && isImaginary) {
              comp.unit = UNITS.VAR;
            } else if (comp.unit.name === 'VAR' && !isImaginary) {
              comp.unit = UNITS.VA;
            }
          }
        }
      }
    }

    /**
     * Helper to apply the best prefix if needed
     * @param simp - The unit to be normalized
     */
    function applyBestPrefixIfNeeded(simp: UnitInstance, offset: number | undefined): void {
      if (simp.units.length === 1 && !simp.fixPrefix) {
        // Units must have integer powers, otherwise the prefix will change the
        // outputted value by not-an-integer-power-of-ten
        if (Math.abs(simp.units[0].power - Math.round(simp.units[0].power)) < 1e-14) {
          // Apply the best prefix
          simp.units[0].prefix = simp._bestPrefix(offset);
        }
      }
    }

    /**
     * Calculate the best prefix using current value.
     * @memberof Unit
     * @returns prefix
     * @param offset - Optional offset for the best prefix calculation (default 1.2)
     * @private
     */
    Unit.prototype._bestPrefix = function (this: UnitInstance, offset: number = 1.2): PrefixDef {
      if (this.units.length !== 1) {
        throw new Error(
          'Can only compute the best prefix for single units with integer powers, like kg, s^2, N^-1, and so forth!'
        );
      }
      if (Math.abs(this.units[0].power - Math.round(this.units[0].power)) >= 1e-14) {
        throw new Error(
          'Can only compute the best prefix for single units with integer powers, like kg, s^2, N^-1, and so forth!'
        );
      }

      // find the best prefix value (resulting in the value of which
      // the absolute value of the log10 is closest to zero,
      // though with a little offset of 1.2 for nicer values: you get a
      // sequence 1mm 100mm 500mm 0.6m 1m 10m 100m 500m 0.6km 1km ...

      // Note: the units value can be any numeric type, but to find the best
      // prefix it's enough to work with limited precision of a regular number
      // Update: using mathjs abs since we also allow complex numbers
      // The best-prefix search works in regular-number precision regardless of
      // the value's numeric type (cast is type-only; matches mathjs behavior).
      const absValue = this.value !== null ? (abs(this.value) as number) : 0;
      const absUnitValue = abs(this.units[0].unit.value!) as number;
      let bestPrefix = this.units[0].prefix;
      if (absValue === 0) {
        return bestPrefix;
      }
      const power = this.units[0].power;
      let bestDiff =
        Math.log(absValue / Math.pow(bestPrefix.value * absUnitValue, power)) / Math.LN10 - offset;
      if (bestDiff > -2.200001 && bestDiff < 1.800001) return bestPrefix; // Allow the original prefix
      bestDiff = Math.abs(bestDiff);
      const prefixes = this.units[0].unit.prefixes!;
      for (const p in prefixes) {
        if (hasOwnProperty(prefixes, p)) {
          const prefix = prefixes[p];
          if (prefix.scientific) {
            const diff = Math.abs(
              Math.log(absValue / Math.pow(prefix.value * absUnitValue, power)) / Math.LN10 - offset
            );
            if (
              diff < bestDiff ||
              (diff === bestDiff && prefix.name.length < bestPrefix.name.length)
            ) {
              // choose the prefix with the smallest diff, or if equal, choose the one
              // with the shortest name (can happen with SHORTLONG for example)
              bestPrefix = prefix;
              bestDiff = diff;
            }
          }
        }
      }
      return bestPrefix;
    };

    /**
     * Returns an array of units whose sum is equal to this unit
     * @memberof Unit
     * @param parts - Optional. An array of strings or valueless units.
     *
     *   Example:
     *
     *   const u = new Unit(1, 'm')
     *   u.splitUnit(['feet', 'inch'])
     *     [ 3 feet, 3.3700787401575 inch ]
     *
     * @return An array of units.
     */
    Unit.prototype.splitUnit = function (
      this: UnitInstance,
      parts: Array<string | UnitInstance>
    ): UnitInstance[] {
      let x: UnitInstance = this.clone();
      const ret: UnitInstance[] = [];
      for (let i = 0; i < parts.length; i++) {
        // Convert x to the requested unit
        x = x.to(parts[i]);
        if (i === parts.length - 1) break;

        // Get the numeric value of this unit
        const xNumeric = x.toNumeric();

        // Check to see if xNumeric is nearly equal to an integer,
        // since fix can incorrectly round down if there is round-off error
        // (`x` was just converted via `.to`, so it always has a value here).
        const xRounded = round(xNumeric!);
        let xFixed: Numeric;
        const isNearlyEqual = equal(xRounded, xNumeric);
        if (isNearlyEqual) {
          xFixed = xRounded;
        } else {
          xFixed = fix(x.toNumeric()!);
        }

        const y = new Unit(xFixed, parts[i].toString());
        ret.push(y);
        x = subtractScalar(x, y);
      }

      // This little bit fixes a bug where the remainder should be 0 but is a little bit off.
      // But instead of comparing x, the remainder, with zero--we will compare the sum of
      // all the parts so far with the original value. If they are nearly equal,
      // we set the remainder to 0.
      let testSum: Numeric = 0;
      for (let i = 0; i < ret.length; i++) {
        testSum = addScalar(testSum, ret[i].value!);
      }
      if (equal(testSum, this.value)) {
        x.value = 0;
      }

      ret.push(x);

      return ret;
    };

    /**
     * The prefix tables, built from the unit table's prefix sets
     * (`UNIT_PREFIX_SETS`): each prefix's value is its exact factor
     * (`radix^power`) rounded once. The `_SI` / `_IEC` halves of the binary
     * sets stay available under their old keys.
     */
    const PREFIXES: Record<string, PrefixTable> = {};
    const prefixTable = (
      set: Readonly<Record<string, UnitPrefix>>,
      keep: (prefix: UnitPrefix, name: string) => boolean = () => true
    ): PrefixTable => {
      const table: PrefixTable = {};
      for (const name of Object.keys(set)) {
        const prefix = set[name]!;
        if (name !== '' && !keep(prefix, name)) continue;
        const exact = unitPrefixExactScale(prefix);
        const def: PrefixDef = {
          name,
          value: exactScaleToNumber(exact),
          scientific: prefix.scientific,
        };
        prefixScales.set(def, exact);
        table[name] = def;
      }
      return table;
    };
    for (const key of Object.keys(UNIT_PREFIX_SETS) as UnitPrefixSetKey[]) {
      PREFIXES[key] = prefixTable(UNIT_PREFIX_SETS[key]);
    }
    PREFIXES.BINARY_SHORT_SI = prefixTable(UNIT_PREFIX_SETS.BINARY_SHORT, (p) => p.radix === 10);
    PREFIXES.BINARY_SHORT_IEC = prefixTable(UNIT_PREFIX_SETS.BINARY_SHORT, (p) => p.radix === 1024);
    PREFIXES.BINARY_LONG_SI = prefixTable(UNIT_PREFIX_SETS.BINARY_LONG, (p) => p.radix === 10);
    PREFIXES.BINARY_LONG_IEC = prefixTable(UNIT_PREFIX_SETS.BINARY_LONG, (p) => p.radix === 1024);

    /* Internally, each unit is represented by a value and a dimension array. The elements of the dimensions array have the following meaning:
     * Index  Dimension
     * -----  ---------
     *   0    Length
     *   1    Mass
     *   2    Time
     *   3    Current
     *   4    Temperature
     *   5    Luminous intensity
     *   6    Amount of substance
     *   7    Angle
     *   8    Bit (digital)
     * For example, the unit "298.15 K" is a pure temperature and would have a value of 298.15 and a dimension array of [0, 0, 0, 0, 1, 0, 0, 0, 0]. The unit "1 cal / (gm °C)" can be written in terms of the 9 fundamental dimensions as [length^2] / ([time^2] * [temperature]), and would a value of (after conversion to SI) 4184.0 and a dimensions array of [2, 0, -2, 0, -1, 0, 0, 0, 0].
     *
     */

    const BASE_DIMENSIONS: string[] = [
      'MASS',
      'LENGTH',
      'TIME',
      'CURRENT',
      'TEMPERATURE',
      'LUMINOUS_INTENSITY',
      'AMOUNT_OF_SUBSTANCE',
      'ANGLE',
      'BIT',
      'SOLID_ANGLE',
    ];

    const BASE_UNITS: Record<string, BaseUnitDef> = {
      NONE: {
        dimensions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      MASS: {
        dimensions: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      LENGTH: {
        dimensions: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      TIME: {
        dimensions: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      },
      CURRENT: {
        dimensions: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      },
      TEMPERATURE: {
        dimensions: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      },
      LUMINOUS_INTENSITY: {
        dimensions: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      },
      AMOUNT_OF_SUBSTANCE: {
        dimensions: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      },

      FORCE: {
        dimensions: [1, 1, -2, 0, 0, 0, 0, 0, 0, 0],
      },
      SURFACE: {
        dimensions: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      VOLUME: {
        dimensions: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      ENERGY: {
        dimensions: [1, 2, -2, 0, 0, 0, 0, 0, 0, 0],
      },
      POWER: {
        dimensions: [1, 2, -3, 0, 0, 0, 0, 0, 0, 0],
      },
      PRESSURE: {
        dimensions: [1, -1, -2, 0, 0, 0, 0, 0, 0, 0],
      },

      ELECTRIC_CHARGE: {
        dimensions: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
      },
      ELECTRIC_CAPACITANCE: {
        dimensions: [-1, -2, 4, 2, 0, 0, 0, 0, 0, 0],
      },
      ELECTRIC_POTENTIAL: {
        dimensions: [1, 2, -3, -1, 0, 0, 0, 0, 0, 0],
      },
      ELECTRIC_RESISTANCE: {
        dimensions: [1, 2, -3, -2, 0, 0, 0, 0, 0, 0],
      },
      ELECTRIC_INDUCTANCE: {
        dimensions: [1, 2, -2, -2, 0, 0, 0, 0, 0, 0],
      },
      ELECTRIC_CONDUCTANCE: {
        dimensions: [-1, -2, 3, 2, 0, 0, 0, 0, 0, 0],
      },
      MAGNETIC_FLUX: {
        dimensions: [1, 2, -2, -1, 0, 0, 0, 0, 0, 0],
      },
      MAGNETIC_FLUX_DENSITY: {
        dimensions: [1, 0, -2, -1, 0, 0, 0, 0, 0, 0],
      },

      FREQUENCY: {
        dimensions: [0, 0, -1, 0, 0, 0, 0, 0, 0, 0],
      },
      ANGLE: {
        dimensions: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
      },
      BIT: {
        dimensions: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      },
      SOLID_ANGLE: {
        dimensions: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      },
    };

    for (const key in BASE_UNITS) {
      if (hasOwnProperty(BASE_UNITS, key)) {
        BASE_UNITS[key].key = key;
      }
    }

    // Intentionally an empty marker object (mathjs `BASE_UNIT_NONE`). Its
    // `dimensions` are never read; cast keeps the runtime value `{}` exactly.
    const BASE_UNIT_NONE = {} as BaseUnitDef;

    const UNIT_NONE: UnitDef = {
      name: '',
      base: BASE_UNIT_NONE,
      value: 1,
      offset: 0,
      dimensions: BASE_DIMENSIONS.map((_x) => 0),
    };

    /**
     * The imaginary unit times `scale`, for a reactive-power row (VAR). The
     * dependency set's `Complex.I` is used as is when the scale is 1 (it may be
     * absent in a dependency set without one, as before).
     */
    function imaginaryValue(scale: number): Numeric {
      const i = Complex.I as unknown as Numeric;
      return scale === 1 || i === undefined ? i : multiplyScalar(i, scale);
    }

    /**
     * The built-in units, built from the one unit table (`unit-table.ts`). Each
     * row's `value` is its exact scale rounded once; `exact` keeps the exact
     * scale so conversions multiply exactly and round once at the end. A VAR's
     * value is imaginary, so it has no real exact scale.
     */
    const UNITS: Record<string, UnitDef> = {};
    for (const key of Object.keys(UNIT_ROWS)) {
      const row = UNIT_ROWS[key]!;
      const exact = readUnitScale(row.scale);
      const scaled = exactScaleToNumber(exact);
      const exactOffset = row.offset === undefined ? UNIT_ZERO_SCALE : readUnitScale(row.offset);
      const def: UnitDef = {
        name: row.name ?? key,
        base: BASE_UNITS[row.base],
        prefixes: PREFIXES[row.prefixes],
        value: row.imaginary ? imaginaryValue(scaled) : scaled,
        offset: exactScaleToNumber(exactOffset),
      };
      if (row.reciprocal) def.reciprocal = true;
      if (!row.imaginary) attachExactScale(def, exact, exactOffset);
      UNITS[key] = def;
    }

    /**
     * Set the value of every unit whose scale carries a power of π (the angle
     * units) in the configured number type: a BigNumber computed from the exact
     * scale under `config.number === 'BigNumber'`, else the exact scale rounded
     * once to a double. Aliases are included, so `degrees` follows `deg`.
     * @param config
     */
    function calculateAngleValues(config: UnitConfig): void {
      for (const key in UNITS) {
        if (!hasOwnProperty(UNITS, key)) continue;
        const exact = UNITS[key].exact;
        if (exact === undefined || exact.pi === 0) continue;
        UNITS[key].value =
          config.number === 'BigNumber' ? exactToBigNumber(exact) : exactScaleToNumber(exact);
      }
    }

    if (on) {
      // recalculate the values on change of configuration
      on('config', function (curr: UnitConfig, prev: UnitConfig) {
        if (curr.number !== prev.number) {
          calculateAngleValues(curr);
        }
      });
    }

    /**
     * A unit system is a set of dimensionally independent base units plus a set of derived units, formed by multiplication and division of the base units, that are by convention used with the unit system.
     * A user perhaps could issue a command to select a preferred unit system, or use the default (see below).
     * Auto unit system: The default unit system is updated on the fly anytime a unit is parsed. The corresponding unit in the default unit system is updated, so that answers are given in the same units the user supplies.
     */
    const UNIT_SYSTEMS: Record<string, UnitSystem> = {
      si: {
        // Base units
        NONE: { unit: UNIT_NONE, prefix: PREFIXES.NONE[''] },
        LENGTH: { unit: UNITS.m, prefix: PREFIXES.SHORT[''] },
        MASS: { unit: UNITS.g, prefix: PREFIXES.SHORT.k },
        TIME: { unit: UNITS.s, prefix: PREFIXES.SHORT[''] },
        CURRENT: { unit: UNITS.A, prefix: PREFIXES.SHORT[''] },
        TEMPERATURE: { unit: UNITS.K, prefix: PREFIXES.SHORT[''] },
        LUMINOUS_INTENSITY: { unit: UNITS.cd, prefix: PREFIXES.SHORT[''] },
        AMOUNT_OF_SUBSTANCE: { unit: UNITS.mol, prefix: PREFIXES.SHORT[''] },
        ANGLE: { unit: UNITS.rad, prefix: PREFIXES.SHORT[''] },
        SOLID_ANGLE: { unit: UNITS.sr, prefix: PREFIXES.NONE[''] },
        BIT: { unit: UNITS.bits, prefix: PREFIXES.SHORT[''] },

        // Derived units
        FORCE: { unit: UNITS.N, prefix: PREFIXES.SHORT[''] },
        ENERGY: { unit: UNITS.J, prefix: PREFIXES.SHORT[''] },
        POWER: { unit: UNITS.W, prefix: PREFIXES.SHORT[''] },
        PRESSURE: { unit: UNITS.Pa, prefix: PREFIXES.SHORT[''] },
        ELECTRIC_CHARGE: { unit: UNITS.C, prefix: PREFIXES.SHORT[''] },
        ELECTRIC_CAPACITANCE: { unit: UNITS.F, prefix: PREFIXES.SHORT[''] },
        ELECTRIC_POTENTIAL: { unit: UNITS.V, prefix: PREFIXES.SHORT[''] },
        ELECTRIC_RESISTANCE: { unit: UNITS.ohm, prefix: PREFIXES.SHORT[''] },
        ELECTRIC_INDUCTANCE: { unit: UNITS.H, prefix: PREFIXES.SHORT[''] },
        ELECTRIC_CONDUCTANCE: { unit: UNITS.S, prefix: PREFIXES.SHORT[''] },
        MAGNETIC_FLUX: { unit: UNITS.Wb, prefix: PREFIXES.SHORT[''] },
        MAGNETIC_FLUX_DENSITY: { unit: UNITS.T, prefix: PREFIXES.SHORT[''] },
        FREQUENCY: { unit: UNITS.Hz, prefix: PREFIXES.SHORT[''] },
      },
    };

    // Clone to create the other unit systems
    UNIT_SYSTEMS.cgs = JSON.parse(JSON.stringify(UNIT_SYSTEMS.si));
    UNIT_SYSTEMS.cgs.LENGTH = { unit: UNITS.m, prefix: PREFIXES.SHORT.c };
    UNIT_SYSTEMS.cgs.MASS = { unit: UNITS.g, prefix: PREFIXES.SHORT[''] };
    UNIT_SYSTEMS.cgs.FORCE = { unit: UNITS.dyn, prefix: PREFIXES.SHORT[''] };
    UNIT_SYSTEMS.cgs.ENERGY = { unit: UNITS.erg, prefix: PREFIXES.NONE[''] };
    // there are wholly 4 unique cgs systems for electricity and magnetism,
    // so let's not worry about it unless somebody complains

    UNIT_SYSTEMS.us = JSON.parse(JSON.stringify(UNIT_SYSTEMS.si));
    UNIT_SYSTEMS.us.LENGTH = { unit: UNITS.ft, prefix: PREFIXES.NONE[''] };
    UNIT_SYSTEMS.us.MASS = { unit: UNITS.lbm, prefix: PREFIXES.NONE[''] };
    UNIT_SYSTEMS.us.TEMPERATURE = {
      unit: UNITS.degF,
      prefix: PREFIXES.NONE[''],
    };
    UNIT_SYSTEMS.us.FORCE = { unit: UNITS.lbf, prefix: PREFIXES.NONE[''] };
    UNIT_SYSTEMS.us.ENERGY = { unit: UNITS.BTU, prefix: PREFIXES.BTU[''] };
    UNIT_SYSTEMS.us.POWER = { unit: UNITS.hp, prefix: PREFIXES.NONE[''] };
    UNIT_SYSTEMS.us.PRESSURE = { unit: UNITS.psi, prefix: PREFIXES.NONE[''] };

    // Add additional unit systems here.

    // Choose a unit system to seed the auto unit system.
    UNIT_SYSTEMS.auto = JSON.parse(JSON.stringify(UNIT_SYSTEMS.si));

    // Set the current unit system
    let currentUnitSystem = UNIT_SYSTEMS.auto;

    /**
     * Set a unit system for formatting derived units.
     * @memberof Unit
     * @param name - Optional. The name of the unit system.
     */
    Unit.setUnitSystem = function (name: string): void {
      if (hasOwnProperty(UNIT_SYSTEMS, name)) {
        currentUnitSystem = UNIT_SYSTEMS[name];
      } else {
        throw new Error(
          'Unit system ' +
            name +
            ' does not exist. Choices are: ' +
            Object.keys(UNIT_SYSTEMS).join(', ')
        );
      }
    };

    /**
     * Return the current unit system.
     * @memberof Unit
     * @return The current unit system.
     */
    Unit.getUnitSystem = function (): string | undefined {
      for (const key in UNIT_SYSTEMS) {
        if (hasOwnProperty(UNIT_SYSTEMS, key)) {
          if (UNIT_SYSTEMS[key] === currentUnitSystem) {
            return key;
          }
        }
      }
      return undefined;
    };

    /**
     * Converters to convert from number to an other numeric type like BigNumber
     * or Fraction
     */
    const typeConverters: TypeConverters = {
      BigNumber: function (x: Numeric): Numeric {
        const fx = x as FractionValue;
        if (fx?.isFraction) {
          return new BigNumber(String(fx.n)).div(String(fx.d)).times(String(fx.s));
        }
        // `+ ''` stringifies via ToPrimitive exactly as before; the cast is
        // type-only (operand may be number/BigNumber at runtime).
        return new BigNumber((x as number) + '');
      },

      Fraction: function (x: Numeric): Numeric {
        return new Fraction(x);
      },

      Complex: function (x: Numeric): Numeric {
        return x;
      },

      number: function (x: Numeric): Numeric {
        if ((x as FractionValue)?.isFraction) return number(x);
        return x;
      },
    };
    Unit.typeConverters = typeConverters;

    /**
     * Retrieve the right converter function corresponding with this unit's
     * value
     *
     * @memberof Unit
     * @return
     */
    Unit.prototype._numberConverter = function (this: UnitInstance): ConverterFn {
      const convert = Unit.typeConverters[this.valueType()];
      if (convert) {
        return convert;
      }
      throw new TypeError('Unsupported Unit value type "' + this.valueType() + '"');
    };

    /**
     * Retrieve the right convertor function corresponding with the type
     * of provided exampleValue.
     *
     * @param type - A string 'number', 'BigNumber', or 'Fraction'
     *                        In case of an unknown type,
     * @return
     */
    Unit._getNumberConverter = function (type: string): ConverterFn {
      if (!Unit.typeConverters[type]) {
        throw new TypeError('Unsupported type "' + type + '"');
      }

      return Unit.typeConverters[type];
    };

    // Add dimensions to each built-in unit
    for (const key in UNITS) {
      if (hasOwnProperty(UNITS, key)) {
        const unit = UNITS[key];
        unit.dimensions = unit.base!.dimensions;
      }
    }

    // Create aliases
    for (const name in UNIT_ROW_ALIASES) {
      if (hasOwnProperty(UNIT_ROW_ALIASES, name)) {
        const unit = UNITS[UNIT_ROW_ALIASES[name]!];
        const alias = {} as UnitDef;
        const aliasRec = alias as unknown as Record<string, unknown>;
        const unitRec = unit as unknown as Record<string, unknown>;
        for (const key in unitRec) {
          if (hasOwnProperty(unitRec, key)) {
            aliasRec[key] = unitRec[key];
          }
        }
        alias.name = name;
        if (unit.exact !== undefined) attachExactScale(alias, unit.exact, unit.exactOffset!);
        UNITS[name] = alias;
      }
    }

    // apply the angle values now, to the rows and their aliases
    calculateAngleValues(config);

    /**
     * Checks if a character is a valid latin letter (upper or lower case).
     * Note that this function can be overridden, for example to allow support of other alphabets.
     * @memberof Unit
     * @param c - Tested character
     * @return true if the character is a latin letter
     */
    Unit.isValidAlpha = function isValidAlpha(c: string): boolean {
      return /^[a-zA-Z]$/.test(c);
    };

    function assertUnitNameIsValid(name: string): void {
      for (let i = 0; i < name.length; i++) {
        c = name.charAt(i);

        if (i === 0 && !Unit.isValidAlpha(c)) {
          throw new Error('Invalid unit name (must begin with alpha character): "' + name + '"');
        }

        if (i > 0 && !(Unit.isValidAlpha(c) || isDigit(c))) {
          throw new Error(
            'Invalid unit name (only alphanumeric characters are allowed): "' + name + '"'
          );
        }
      }
    }

    /**
     * Wrapper around createUnitSingle.
     * Example:
     *  createUnit( {
     *     foo: {
     *       prefixes: 'long',
     *       baseName: 'essence-of-foo'
     *     },
     *     bar: '40 foo',
     *     baz: {
     *       definition: '1 bar/hour',
     *       prefixes: 'long'
     *     }
     *   },
     *   {
     *     override: true
     *   })
     * @memberof Unit
     * @param obj - Object map. Each key becomes a unit which is defined by its value.
     * @param options
     * @return the last created unit
     */
    Unit.createUnit = function (
      obj: Record<string, unknown>,
      options?: CreateUnitOptions
    ): UnitInstance | undefined {
      if (typeof obj !== 'object') {
        throw new TypeError("createUnit expects first parameter to be of type 'Object'");
      }

      // Remove all units and aliases we are overriding
      if (options && options.override) {
        for (const key in obj) {
          if (hasOwnProperty(obj, key)) {
            Unit.deleteUnit(key);
          }
          const aliases = (obj[key] as CreateUnitDefObject).aliases;
          if (aliases) {
            for (let i = 0; i < aliases.length; i++) {
              Unit.deleteUnit(aliases[i]);
            }
          }
        }
      }

      // TODO: traverse multiple times until all units have been added
      let lastUnit: UnitInstance | undefined;
      for (const key in obj) {
        if (hasOwnProperty(obj, key)) {
          lastUnit = Unit.createUnitSingle(key, obj[key]);
        }
      }
      return lastUnit;
    };

    /**
     * Create a user-defined unit and register it with the Unit type.
     * Example:
     *  createUnitSingle('knot', '0.514444444 m/s')
     *
     * @memberof Unit
     * @param name - The name of the new unit. Must be unique. Example: 'knot'
     * @param definition - Definition of the unit in terms
     * of existing units. For example, '0.514444444 m / s'. Can be a Unit, a string,
     * or an Object. If an Object, may have the following properties:
     *   - definition {string | Unit} The definition of this unit.
     *   - prefixes {string} "none", "short", "long", "binary_short", or "binary_long".
     *     The default is "none".
     *   - aliases {Array} Array of strings. Example: ['knots', 'kt', 'kts']
     *   - offset {Numeric} An offset to apply when converting from the unit. For
     *     example, the offset for celsius is 273.15 and the offset for farhenheit
     *     is 459.67. Default is 0.
     *   - baseName {string} If the unit's dimension does not match that of any other
     *     base unit, the name of the newly create base unit. Otherwise, this property
     *     has no effect.
     *
     * @return
     */
    Unit.createUnitSingle = function (name: string, obj?: unknown): UnitInstance {
      if (typeof obj === 'undefined' || obj === null) {
        obj = {};
      }

      if (typeof name !== 'string') {
        throw new TypeError("createUnitSingle expects first parameter to be of type 'string'");
      }

      // Check collisions with existing units
      if (hasOwnProperty(UNITS, name)) {
        throw new Error('Cannot create unit "' + name + '": a unit with that name already exists');
      }

      // TODO: Validate name for collisions with other built-in functions (like abs or cos, for example), and for acceptable variable names. For example, '42' is probably not a valid unit. Nor is '%', since it is also an operator.

      assertUnitNameIsValid(name);

      let defUnit: UnitInstance | null = null; // The Unit from which the new unit will be created.
      let aliases: string[] = [];
      let offset: number | undefined = 0;
      let definition: unknown;
      let prefixes: string | PrefixTable | undefined;
      let baseName: string | undefined;
      if (obj && (obj as { type?: unknown }).type === 'Unit') {
        defUnit = (obj as UnitInstance).clone();
      } else if (typeof obj === 'string') {
        if (obj !== '') {
          definition = obj;
        }
      } else if (typeof obj === 'object') {
        const def = obj as CreateUnitDefObject;
        definition = def.definition;
        prefixes = def.prefixes;
        offset = def.offset;
        baseName = def.baseName;
        if (def.aliases) {
          aliases = def.aliases.valueOf() as string[]; // aliases could be a Matrix, so convert to Array
        }
      } else {
        throw new TypeError(
          'Cannot create unit "' +
            name +
            '" from "' +
            (obj as { toString(): string }).toString() +
            '": expecting "string" or "Unit" or "Object"'
        );
      }

      if (aliases) {
        for (let i = 0; i < aliases.length; i++) {
          if (hasOwnProperty(UNITS, aliases[i])) {
            throw new Error(
              'Cannot create alias "' + aliases[i] + '": a unit with that name already exists'
            );
          }
        }
      }

      if (definition && typeof definition === 'string' && !defUnit) {
        try {
          defUnit = Unit.parse(definition, { allowNoUnits: true });
        } catch (ex) {
          (ex as Error).message =
            'Could not create unit "' +
            name +
            '" from "' +
            definition +
            '": ' +
            (ex as Error).message;
          throw ex;
        }
      } else if (definition && (definition as { type?: unknown }).type === 'Unit') {
        defUnit = (definition as UnitInstance).clone();
      }

      aliases = aliases || [];
      offset = offset || 0;
      if (prefixes && (prefixes as string).toUpperCase) {
        prefixes = PREFIXES[(prefixes as string).toUpperCase()] || PREFIXES.NONE;
      } else {
        prefixes = PREFIXES.NONE;
      }

      // If defUnit is null, it is because the user did not
      // specify a defintion. So create a new base dimension.
      let newUnit: UnitDef;
      if (!defUnit) {
        // Add a new base dimension
        baseName = baseName || name + '_STUFF'; // foo --> foo_STUFF, or the essence of foo
        if (BASE_DIMENSIONS.indexOf(baseName) >= 0) {
          throw new Error(
            'Cannot create new base unit "' +
              name +
              '": a base unit with that name already exists (and cannot be overridden)'
          );
        }
        BASE_DIMENSIONS.push(baseName);

        // Push 0 onto existing base units
        for (const b in BASE_UNITS) {
          if (hasOwnProperty(BASE_UNITS, b)) {
            BASE_UNITS[b].dimensions[BASE_DIMENSIONS.length - 1] = 0;
          }
        }

        // Add the new base unit
        const newBaseUnit: BaseUnitDef = { dimensions: [] };
        for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
          newBaseUnit.dimensions[i] = 0;
        }
        newBaseUnit.dimensions[BASE_DIMENSIONS.length - 1] = 1;
        newBaseUnit.key = baseName;
        BASE_UNITS[baseName] = newBaseUnit;

        newUnit = {
          name,
          value: 1,
          dimensions: BASE_UNITS[baseName].dimensions.slice(0),
          prefixes,
          offset,
          base: BASE_UNITS[baseName],
        };

        currentUnitSystem[baseName] = {
          unit: newUnit,
          prefix: PREFIXES.NONE[''],
        };
      } else {
        newUnit = {
          name,
          value: defUnit.value,
          dimensions: defUnit.dimensions.slice(0),
          prefixes,
          offset,
        };

        // Create a new base if no matching base exists
        let anyMatch = false;
        for (const i in BASE_UNITS) {
          if (hasOwnProperty(BASE_UNITS, i)) {
            let match = true;
            for (let j = 0; j < BASE_DIMENSIONS.length; j++) {
              if (
                Math.abs((newUnit.dimensions![j] || 0) - (BASE_UNITS[i].dimensions[j] || 0)) > 1e-12
              ) {
                match = false;
                break;
              }
            }
            if (match) {
              anyMatch = true;
              newUnit.base = BASE_UNITS[i];
              break;
            }
          }
        }
        if (!anyMatch) {
          baseName = baseName || name + '_STUFF'; // foo --> foo_STUFF, or the essence of foo
          // Add the new base unit
          const newBaseUnit: BaseUnitDef = { dimensions: defUnit.dimensions.slice(0) };
          newBaseUnit.key = baseName;
          BASE_UNITS[baseName] = newBaseUnit;

          currentUnitSystem[baseName] = {
            unit: newUnit,
            prefix: PREFIXES.NONE[''],
          };

          newUnit.base = BASE_UNITS[baseName];
        }
      }

      Unit.UNITS[name] = newUnit;

      for (let i = 0; i < aliases.length; i++) {
        const aliasName = aliases[i];
        const alias = {} as UnitDef;
        const aliasRec = alias as unknown as Record<string, unknown>;
        const newUnitRec = newUnit as unknown as Record<string, unknown>;
        for (const key in newUnitRec) {
          if (hasOwnProperty(newUnitRec, key)) {
            aliasRec[key] = newUnitRec[key];
          }
        }
        alias.name = aliasName;
        Unit.UNITS[aliasName] = alias;
      }

      // delete the memoization cache because we created a new unit
      delete _findUnit.cache;

      return new Unit(null, name);
    };

    Unit.deleteUnit = function (name: string): void {
      delete Unit.UNITS[name];

      // delete the memoization cache because we deleted a unit
      delete _findUnit.cache;
    };

    // expose arrays with prefixes, dimensions, units, systems
    Unit.PREFIXES = PREFIXES;
    Unit.BASE_DIMENSIONS = BASE_DIMENSIONS;
    Unit.BASE_UNITS = BASE_UNITS;
    Unit.UNIT_SYSTEMS = UNIT_SYSTEMS;
    Unit.UNITS = UNITS;

    return Unit;
  },
  { isClass: true }
);
