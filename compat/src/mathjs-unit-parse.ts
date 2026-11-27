/**
 * `Unit.parse` with the mathjs 15.3.0 grammar for the compat instance unit class (#1784).
 *
 * Native `core` extends the grammar: an affine unit inside a compound is refused,
 * an implicit multiplication after a solidus stays in the denominator, tokens split
 * into factors, and parse errors are `UnitParseError`. mathjs 15.3.0 reads
 * `1 m^3 / kg s^2` as `(m^3 / kg) * s^2`, accepts `m degC`, and throws `SyntaxError`.
 * This module ports the mathjs parser so that the instance `Unit.parse` matches it.
 * It reads the tables through the public statics of the instance class
 * (`_findUnit`, `UNIT_SYSTEMS`, `BASE_DIMENSIONS`, `isValidAlpha`) and never touches
 * the native class.
 *
 * @packageDocumentation
 */
/** A unit definition as `_findUnit` returns it (the fields the parser reads). */
type ParsedUnitDef = {
  dimensions?: readonly number[];
  base?: { key?: string };
};

/** One `{ unit, prefix, power }` entry of a parsed unit. */
type ParsedComponent = {
  unit: ParsedUnitDef;
  prefix: unknown;
  power: number;
};

/** The parts of a unit instance the parser builds. */
type ParsedUnit = {
  units: ParsedComponent[];
  dimensions: number[];
  value: unknown;
  _normalize(value: unknown): unknown;
};

/** The statics of the instance unit class that the parser needs. */
export type MathjsUnitParseHost = {
  new (): ParsedUnit;
  BASE_DIMENSIONS: readonly string[];
  UNIT_SYSTEMS: Record<string, Record<string, unknown>>;
  typeConverters: Record<string, (x: unknown) => unknown>;
  _findUnit(name: string): { unit: ParsedUnitDef; prefix: unknown } | null;
  isValidAlpha(c: string): boolean;
};

/** Options accepted by the mathjs `Unit.parse`. */
export type MathjsUnitParseOptions = { allowNoUnits?: boolean };

/** Signature of the mathjs `Unit.parse`. */
export type MathjsUnitParse = (str: string, options?: MathjsUnitParseOptions) => ParsedUnit;

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isDigitDot(c: string): boolean {
  return isDigit(c) || c === '.';
}

/**
 * Build the mathjs 15.3.0 `Unit.parse` for one instance unit class.
 *
 * @param Unit - The instance unit class (its statics are read at call time).
 * @param numberMode - Live read of the instance `config.number`.
 * @returns A function with the mathjs `Unit.parse(str, options)` signature.
 */
export function createMathjsUnitParse(
  Unit: MathjsUnitParseHost,
  numberMode: () => string | undefined
): MathjsUnitParse {
  return function parse(str: string, options: MathjsUnitParseOptions = {}): ParsedUnit {
    const text = str;
    let index = -1;
    let c = '';

    if (typeof text !== 'string') {
      throw new TypeError('Invalid argument in Unit.parse, string expected');
    }

    const next = (): void => {
      index++;
      c = text.charAt(index);
    };
    const skipWhitespace = (): void => {
      while (c === ' ' || c === '\t') next();
    };
    const revert = (oldIndex: number): void => {
      index = oldIndex;
      c = text.charAt(index);
    };
    const parseCharacter = (toFind: string): string | null => {
      if (c === toFind) {
        next();
        return toFind;
      }
      return null;
    };

    const parseNumber = (): string | null => {
      let number = '';
      const oldIndex = index;

      if (c === '+') {
        next();
      } else if (c === '-') {
        number += c;
        next();
      }

      if (!isDigitDot(c)) {
        revert(oldIndex);
        return null;
      }

      if (c === '.') {
        number += c;
        next();
        if (!isDigit(c)) {
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

      if (c === 'E' || c === 'e') {
        // Either an exponent or the start of a unit such as "4exabytes".
        let tentativeNumber = '';
        const tentativeIndex = index;

        tentativeNumber += c;
        next();

        // `next()` reassigns the closure cursor, which narrowing cannot see.
        if ((c as string) === '+' || (c as string) === '-') {
          tentativeNumber += c;
          next();
        }

        if (!isDigit(c)) {
          revert(tentativeIndex);
          return number;
        }

        number += tentativeNumber;
        while (isDigit(c)) {
          number += c;
          next();
        }
      }

      return number;
    };

    const parseUnit = (): string | null => {
      let unitName = '';
      while (isDigit(c) || Unit.isValidAlpha(c)) {
        unitName += c;
        next();
      }
      return Unit.isValidAlpha(unitName.charAt(0)) ? unitName : null;
    };

    const unit = new Unit();
    unit.units = [];

    let powerMultiplierCurrent = 1;
    let expectingUnit = false;

    next();
    skipWhitespace();

    const valueStr = parseNumber();
    let value: unknown = null;
    if (valueStr) {
      const mode = numberMode();
      if (mode === 'BigNumber') {
        value = Unit.typeConverters.BigNumber(valueStr);
      } else if (mode === 'Fraction') {
        try {
          value = Unit.typeConverters.Fraction(valueStr);
        } catch {
          value = parseFloat(valueStr);
        }
      } else {
        value = parseFloat(valueStr);
      }

      skipWhitespace();

      if (parseCharacter('*')) {
        powerMultiplierCurrent = 1;
        expectingUnit = true;
      } else if (parseCharacter('/')) {
        powerMultiplierCurrent = -1;
        expectingUnit = true;
      }
    }

    const powerMultiplierStack: number[] = [];
    let powerMultiplierStackProduct = 1;

    for (;;) {
      skipWhitespace();

      while (c === '(') {
        powerMultiplierStack.push(powerMultiplierCurrent);
        powerMultiplierStackProduct *= powerMultiplierCurrent;
        powerMultiplierCurrent = 1;
        next();
        skipWhitespace();
      }

      let uStr: string | null;
      if (c) {
        const oldC = c;
        uStr = parseUnit();
        if (uStr === null) {
          throw new SyntaxError(
            'Unexpected "' + oldC + '" in "' + text + '" at index ' + index.toString()
          );
        }
      } else {
        break;
      }

      const res = Unit._findUnit(uStr);
      if (res === null) {
        throw new SyntaxError('Unit "' + uStr + '" not found.');
      }

      let power = powerMultiplierCurrent * powerMultiplierStackProduct;
      skipWhitespace();
      if (parseCharacter('^')) {
        skipWhitespace();
        const p = parseNumber();
        if (p === null) {
          throw new SyntaxError(
            'In "' + str + '", "^" must be followed by a floating-point number'
          );
        }
        power *= Number(p);
      }

      unit.units.push({ unit: res.unit, prefix: res.prefix, power });
      for (let i = 0; i < Unit.BASE_DIMENSIONS.length; i++) {
        unit.dimensions[i] += (res.unit.dimensions?.[i] || 0) * power;
      }

      skipWhitespace();
      while (c === ')') {
        const popped = powerMultiplierStack.pop();
        if (popped === undefined) {
          throw new SyntaxError('Unmatched ")" in "' + text + '" at index ' + index.toString());
        }
        powerMultiplierStackProduct /= popped;
        next();
        skipWhitespace();
      }

      expectingUnit = false;

      if (parseCharacter('*')) {
        powerMultiplierCurrent = 1;
        expectingUnit = true;
      } else if (parseCharacter('/')) {
        powerMultiplierCurrent = -1;
        expectingUnit = true;
      } else {
        powerMultiplierCurrent = 1;
      }

      const baseKey = res.unit.base?.key;
      if (baseKey !== undefined) {
        Unit.UNIT_SYSTEMS.auto[baseKey] = { unit: res.unit, prefix: res.prefix };
      }
    }

    skipWhitespace();
    if (c) {
      throw new SyntaxError('Could not parse: "' + str + '"');
    }

    if (expectingUnit) {
      throw new SyntaxError('Trailing characters: "' + str + '"');
    }

    if (powerMultiplierStack.length !== 0) {
      throw new SyntaxError('Unmatched "(" in "' + text + '"');
    }

    if (unit.units.length === 0 && !options.allowNoUnits) {
      throw new SyntaxError('"' + str + '" contains no units');
    }

    unit.value = unit._normalize(value);
    return unit;
  };
}
