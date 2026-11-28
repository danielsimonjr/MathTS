/**
 * Per-instance CompatBigNumber (#1780): honors `create({ precision })` via
 * `runWithConfig` without mutating the module-level class.
 */

import { BigNumber as NativeBigNumber, isBigNumber } from '@danielsimonjr/mathts-core';
import { runWithConfig } from '@danielsimonjr/mathts-functions';
import { BigNumber as CompatBigNumber, compatDecimalResult } from './bignumber.js';

type CompatBigNumberClass = InstanceType<typeof CompatBigNumber>;
import { callableWithoutNew } from './constructors-without-new.js';
/** Callable per-instance BigNumber class (#1780). */
export type InstanceBigNumberCtor = typeof CompatBigNumber & {
  (value?: number | string | bigint | boolean | null): CompatBigNumberClass;
};

/** Build a BigNumber class scoped to one compat instance config overlay. */
type RunWithConfigOverlay = Parameters<typeof runWithConfig>[0];

/** Symbol storing the owning compat instance's precision getter on its BigNumber class. */
export const INSTANCE_PRECISION_GETTER = Symbol('compatInstancePrecisionGetter');

/** Create a BigNumber class bound to one compat instance config. */
export function createInstanceBigNumberClass(
  getConfig: () => RunWithConfigOverlay,
  usesOverlay: () => boolean
): InstanceBigNumberCtor {
  class InstanceBigNumber extends CompatBigNumber {}
  Object.defineProperty(InstanceBigNumber, INSTANCE_PRECISION_GETTER, {
    value: () => getConfig().precision ?? 64,
    enumerable: false,
    configurable: true,
  });

  const installScopedMethod = (name: string, method: (...args: unknown[]) => unknown) => {
    Object.defineProperty(InstanceBigNumber.prototype, name, {
      value(this: InstanceBigNumber, ...args: unknown[]) {
        const run = () => Reflect.apply(method, this, args);
        return usesOverlay() ? runWithConfig(getConfig(), run) : run();
      },
      writable: true,
      configurable: true,
    });
  };

  for (const name of Object.getOwnPropertyNames(NativeBigNumber.prototype)) {
    if (name === 'constructor') continue;
    const descriptor = Object.getOwnPropertyDescriptor(NativeBigNumber.prototype, name);
    if (!descriptor || typeof descriptor.value !== 'function') continue;
    const original = CompatBigNumber.prototype[name as keyof CompatBigNumber];
    if (typeof original !== 'function') continue;
    installScopedMethod(name, original as (...args: unknown[]) => unknown);
  }

  const Callable = callableWithoutNew(InstanceBigNumber) as unknown as InstanceBigNumberCtor;
  Object.defineProperty(InstanceBigNumber.prototype, 'constructor', {
    value: Callable,
    writable: true,
    configurable: true,
  });
  Callable.fromJSON = function fromJSON(json: { value: string }): CompatBigNumberClass {
    return new Callable(json.value);
  };
  return Callable;
}

function valueUsesBigNumber(value: unknown): boolean {
  if (isBigNumber(value)) return true;
  if (
    typeof value === 'object' &&
    value !== null &&
    ((value as { isBigNumber?: boolean }).isBigNumber === true ||
      (value as { type?: string }).type === 'BigNumber')
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => valueUsesBigNumber(entry));
  }
  if (typeof value === 'object' && value !== null) {
    const matrix = value as { isMatrix?: boolean; toArray?: () => unknown[] };
    if (matrix.isMatrix === true && typeof matrix.toArray === 'function') {
      return valueUsesBigNumber(matrix.toArray());
    }
  }
  return false;
}

function argsUseBigNumber(args: readonly unknown[]): boolean {
  return args.some((a) => valueUsesBigNumber(a));
}

function fillStructuralZero(value: unknown, zero: unknown): unknown {
  if (value === 0 || value === 0n) return zero;
  if (typeof value === 'number' && Object.is(value, -0)) return zero;
  return value;
}

function promoteDiagZeros(value: unknown, zero: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((entry) => {
      const next = promoteDiagZeros(entry, zero);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (typeof value === 'object' && value !== null) {
    const matrix = value as { isMatrix?: boolean; map?: (cb: (x: unknown) => unknown) => unknown };
    if (matrix.isMatrix === true && typeof matrix.map === 'function') {
      return matrix.map((entry) => fillStructuralZero(entry, zero));
    }
  }
  return fillStructuralZero(value, zero);
}

/** mathjs `diag` fills structural zeros with the vector/matrix datatype's zero (#1780). */
export function createCompatDiag(
  native: (...args: unknown[]) => unknown,
  BigNumberClass: InstanceBigNumberCtor
): (...args: unknown[]) => unknown {
  return (...args: unknown[]): unknown => {
    const result = native(...args);
    if (!argsUseBigNumber(args)) {
      return compatDecimalResult(result);
    }
    const zero = new BigNumberClass(0);
    return compatDecimalResult(promoteDiagZeros(result, zero));
  };
}

/** Promote plain numbers in a range matrix when bounds mix BigNumber and number (#1780). */
export function normalizeCompatRangeResult(
  args: readonly unknown[],
  result: unknown,
  BigNumberClass: InstanceBigNumberCtor,
  matrix?: (data: unknown[]) => unknown
): unknown {
  const includeEnd = args.length >= 1 && args[args.length - 1] === true;
  const rangeEnds = includeEnd ? args.slice(0, -1) : args;
  const endpointUsesBigNumber =
    rangeEnds.length > 0 &&
    rangeEnds.every(
      (value) =>
        isBigNumber(value) ||
        (typeof value === 'object' &&
          value !== null &&
          ((value as { isBigNumber?: boolean }).isBigNumber === true ||
            (value as { type?: string }).type === 'BigNumber'))
    );
  if (matrix && includeEnd && rangeEnds.length === 2 && endpointUsesBigNumber) {
    const toArr = (value: unknown): unknown[] => {
      if (typeof value === 'object' && value !== null) {
        const boxed = value as { isMatrix?: boolean; toArray?: () => unknown[] };
        if (boxed.isMatrix && typeof boxed.toArray === 'function') {
          return boxed.toArray();
        }
      }
      return Array.isArray(value) ? value : [];
    };
    const arr = toArr(result);
    const endText = String(rangeEnds[1]);
    const lastText = arr.length > 0 ? String(arr[arr.length - 1]) : '';
    if (lastText !== endText) {
      const next = arr.map((entry) => new BigNumberClass(String(entry)));
      next.push(new BigNumberClass(endText));
      return matrix(next);
    }
  }
  if (!argsUseBigNumber(args)) {
    return compatDecimalResult(result);
  }
  const bn = (x: unknown): unknown => {
    if (x instanceof BigNumberClass) return x;
    if (isBigNumber(x)) return new BigNumberClass((x as CompatBigNumber).toString());
    if (typeof x === 'number' || typeof x === 'bigint' || typeof x === 'string') {
      return new BigNumberClass(String(x));
    }
    return compatDecimalResult(x);
  };
  if (typeof result === 'object' && result !== null) {
    const matrix = result as { isMatrix?: boolean; map?: (cb: (x: unknown) => unknown) => unknown };
    if (matrix.isMatrix === true && typeof matrix.map === 'function') {
      return matrix.map((cell) => bn(cell));
    }
  }
  return compatDecimalResult(result);
}
