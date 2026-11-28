/**
 * mathjs 15.3.0 number literal parsing for compat parse/evaluate (#1786).
 * Mirrors `selectedNumberOfText` in `functions/src/factories/index.ts`.
 */

const NUMBER_RADICES: Record<string, number> = { '0b': 2, '0o': 8, '0x': 16 };

function numberOfPlainText(text: string): number {
  if (text === 'NaN') return NaN;
  const radixFraction = /(0[box])([0-9a-fA-F]*)\.([0-9a-fA-F]*)/.exec(text);
  if (radixFraction) {
    const [, prefix, whole, digits] = radixFraction;
    const radix = NUMBER_RADICES[prefix];
    let result = parseInt(whole, radix);
    for (let index = 0; index < digits.length; index++) {
      result += parseInt(digits[index], radix) / radix ** (index + 1);
    }
    if (Number.isNaN(result)) throw new SyntaxError(`String "${text}" is not a valid number`);
    return result;
  }
  const n = Number(text);
  if (Number.isNaN(n)) throw new SyntaxError(`String "${text}" is not a valid number`);
  return n;
}

/**
 * Parse a decimal or radix mathjs number literal, including optional `i{bitwidth}` suffix.
 */
export function parseMathjsNumberLiteral(text: string): number {
  const sized = /(0[box][0-9a-fA-F]*)i([0-9]*)/.exec(text);
  if (!sized) return numberOfPlainText(text);
  const [, literal, sizeText] = sized;
  const value = numberOfPlainText(literal);
  const width = Number(sizeText);
  if (value > 2 ** width - 1) throw new SyntaxError(`String "${literal}" is out of range`);
  return value >= 2 ** (width - 1) ? value - 2 ** width : value;
}

/** Wrap the scope `number` helper used by expression `numeric()`. */
export function createParseScopeNumber(
  instanceNumber: (...args: unknown[]) => unknown
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    if (args.length === 1 && typeof args[0] === 'string') {
      return parseMathjsNumberLiteral(args[0] as string);
    }
    return instanceNumber(...args);
  };
}

/** `numeric()` for parse scope: strings route through {@link parseMathjsNumberLiteral}. */
export function createParseScopeNumeric(
  parseNumber: (...args: unknown[]) => unknown,
  baseNumeric: (value: unknown, outputType?: string) => unknown
): (value: unknown, outputType?: string) => unknown {
  return (value: unknown, outputType?: string): unknown => {
    if (typeof value === 'string' && (outputType === 'number' || outputType === undefined)) {
      return parseNumber(value);
    }
    return baseNumeric(value, outputType);
  };
}
