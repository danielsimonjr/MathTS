import { factory } from './factory.js';
import type { BigNumber, Fraction } from '../types.js';

const name = 'parseNumberWithConfig';
const dependencies = ['config', '?bignumber', '?fraction'];

export const createParseNumberWithConfig = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ config, bignumber, fraction }) => {
    /**
     * Parse a string to a number type based on the config.number setting.
     *
     * Respects the configured number type:
     * - config.number = 'number': JavaScript number
     * - config.number = 'BigNumber': BigNumber instance
     * - config.number = 'bigint': bigint (fallback to number for decimals)
     * - config.number = 'Fraction': Fraction instance
     *
     * @param str - String representation of a number
     * @returns Parsed number in configured type
     *
     * @example
     * // With config.number = 'BigNumber'
     * parseNumberWithConfig('10')  // Returns: BigNumber(10)
     *
     * @example
     * // With config.number = 'bigint'
     * parseNumberWithConfig('5')    // Returns: 5n
     * parseNumberWithConfig('3.14') // Returns: 3.14 (number fallback)
     */
    function parseNumberWithConfig(str: string): number | bigint | BigNumber | Fraction {
      if (typeof str !== 'string') {
        throw new TypeError(`parseNumberWithConfig expects string, got ${typeof str}`);
      }

      const numberType = config.number || 'number';

      switch (numberType) {
        case 'BigNumber':
          if (!bignumber) {
            throw new Error('BigNumber not available. Configure mathjs with BigNumber support.');
          }
          return bignumber(str);

        case 'bigint':
          // bigint doesn't support decimals - fallback to number
          if (str.includes('.') || str.includes('e') || str.includes('E')) {
            const num = Number(str);
            if (isNaN(num)) {
              throw new SyntaxError(`String "${str}" is not a valid number`);
            }
            return num;
          }
          try {
            return BigInt(str);
          } catch {
            throw new SyntaxError(`String "${str}" is not a valid number`);
          }

        case 'Fraction': {
          if (!fraction) {
            throw new Error('Fraction not available. Configure mathjs with Fraction support.');
          }
          return fraction(str);
        }

        case 'number':
        default: {
          const num = Number(str);
          if (isNaN(num)) {
            throw new SyntaxError(`String "${str}" is not a valid number`);
          }
          return num;
        }
      }
    }

    return parseNumberWithConfig;
  }
);
