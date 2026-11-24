import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';

// Type definitions for unit toBest
interface Unit {
  toBest(unitList?: string[] | (string | Unit)[], options?: object): Unit;
}

const name = 'toBest';
const dependencies = ['typed'];

function toBestFactory(defaultOffset?: number) {
  return factory(name, dependencies, ({ typed }: { typed: TypedFunction }) => {
    function convert(value: Unit, units?: string | Array<string | Unit>, options?: object): Unit {
      const preferred = typeof units === 'string' ? units.split(',') : units;
      return value.toBest(
        preferred,
        defaultOffset === undefined ? options : { offset: defaultOffset, ...options }
      );
    }

    /**
     * Converts a unit to the most appropriate display unit.
     * When no preferred units are provided, the function automatically find the best prefix.
     * When preferred units are provided, it converts to
     * the unit that gives a value closest to 1.
     *
     * Syntax:
     *
     *    math.toBest(unit)
     *    math.toBest(unit, unitList)
     *    math.toBest(unit, unitList, options)
     *
     * Where:
     * - `unitList` is an optional array of preferred target units as string or Unit.
     * - `options` is an optional object with options, formed as follows:
     * - `offset`: number | BigNumber
     *
     * Examples:
     *
     *   math.unit(0.05, 'm').toBest(['cm', 'mm'])                 // returns Unit 5 cm
     *   math.unit(2 / 3, 'cm').toBest()                           // returns Unit 0.6666666666666666 cm
     *   math.unit(10, 'm').toBest(['mm', 'km'], { offset: 1.5 })  // returns Unit 10000 mm
     *
     * See also:
     *
     *    unit, to, format
     *
     * @param {Unit} x                          The unit to be converted
     * @param {Array<string>} [unitList=[]]     Optional array of preferred target units
     * @param {Object} [options]                Optional options object
     * @return {Unit}                           Value converted to the best matching unit
     */
    return typed(name, {
      Unit: convert,
      'Unit, string | Array': convert,
      'Unit, string | Array, Object': convert,
    });
  });
}

/** Create the native unit display conversion. */
export const createToBest = /* #__PURE__ */ toBestFactory();

/** Create the unit display conversion with MathJS's default engineering offset. */
export const createMathJSToBest = /* #__PURE__ */ toBestFactory(1.2);
