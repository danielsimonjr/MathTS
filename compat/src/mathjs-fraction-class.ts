/**
 * mathjs 15.3.0 `Fraction` type: the fraction.js class with mathjs metadata (#1779).
 *
 * mathjs does not use a custom rational type at runtime; it re-exports fraction.js
 * and patches the prototype with `type`, `isFraction`, `toJSON`, and `fromJSON`. The
 * compat instance exposes the same surface so public unit tests that compare `s`,
 * `n`, and `d` and decimal `toString()` output pass unchanged.
 */
import FractionJS from 'fraction.js';

/** fraction.js instance with mathjs 15.3.0 prototype fields (`type`, `toJSON`, bigint accessors). */
export type MathjsFraction = InstanceType<typeof FractionJS> & {
  readonly type: 'Fraction';
  readonly isFraction: true;
  readonly numerator: bigint;
  readonly denominator: bigint;
  toJSON(): { mathjs: 'Fraction'; n: string; d: string };
};

/** Constructor for mathjs-shaped fraction.js values (`fromJSON`, installed prototype). */
export type MathjsFractionConstructor = typeof FractionJS & {
  new (...args: ConstructorParameters<typeof FractionJS>): MathjsFraction;
  fromJSON(json: { n: string | number | bigint; d: string | number | bigint }): MathjsFraction;
};

const proto = FractionJS.prototype as MathjsFraction;

function fractionToJson(this: MathjsFraction): { mathjs: 'Fraction'; n: string; d: string } {
  return {
    mathjs: 'Fraction',
    n: String(this.s * this.n),
    d: String(this.d),
  };
}

let installed = false;

/** Install mathjs 15.3.0 prototype tags on the bundled fraction.js class (idempotent). */
export function installMathjsFractionClass(): MathjsFractionConstructor {
  if (installed) {
    return FractionJS as MathjsFractionConstructor;
  }
  installed = true;

  Object.defineProperty(FractionJS, 'name', { value: 'Fraction' });
  proto.constructor = FractionJS;
  Object.defineProperty(proto, 'type', { value: 'Fraction' });
  Object.defineProperty(proto, 'isFraction', { value: true });
  Object.defineProperty(proto, Symbol.for('mathts.core.Fraction'), {
    value: true,
    configurable: true,
  });
  Object.defineProperty(proto, 'numerator', {
    configurable: true,
    get(this: MathjsFraction): bigint {
      const s = typeof this.s === 'bigint' ? this.s : BigInt(this.s);
      const n = typeof this.n === 'bigint' ? this.n : BigInt(this.n);
      return s < 0n ? -n : n;
    },
  });
  Object.defineProperty(proto, 'denominator', {
    configurable: true,
    get(this: MathjsFraction): bigint {
      return typeof this.d === 'bigint' ? this.d : BigInt(this.d);
    },
  });
  Object.defineProperty(proto, 'toJSON', {
    configurable: true,
    enumerable: false,
    value: fractionToJson,
  });
  // MathTS typed matrix kernels call `.multiply` on Fraction; fraction.js exposes `.mul`.
  Object.defineProperty(proto, 'equals', {
    configurable: true,
    value: function (this: MathjsFraction, y: unknown): boolean {
      try {
        return this.compare(y as never) === 0;
      } catch {
        const core = y as { numerator?: bigint; denominator?: bigint };
        if (core.numerator !== undefined && core.denominator !== undefined) {
          return (
            this.compare(new mathjsFractionClass(core.numerator, core.denominator) as never) === 0
          );
        }
        return false;
      }
    },
  });
  Object.defineProperty(proto, 'multiply', {
    configurable: true,
    value: function (this: MathjsFraction, y: unknown): MathjsFraction {
      return this.mul(y as ConstructorParameters<typeof FractionJS>[0]) as MathjsFraction;
    },
  });

  const FractionClass = FractionJS as MathjsFractionConstructor;
  FractionClass.fromJSON = function fromJSON(json: {
    n: string | number | bigint;
    d: string | number | bigint;
  }) {
    return new FractionClass(
      json as unknown as ConstructorParameters<typeof FractionJS>[0]
    ) as MathjsFraction;
  };

  return FractionClass;
}

/** The fraction.js constructor after mathjs metadata is installed. */
export const mathjsFractionClass = installMathjsFractionClass();

/** True for mathjs-tagged fraction.js instances from this bundle. */
export function isMathjsFraction(value: unknown): value is MathjsFraction {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isFraction?: boolean }).isFraction === true
  );
}
