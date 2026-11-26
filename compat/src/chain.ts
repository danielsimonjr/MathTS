/**
 * GC12 — mathjs-style fluent `chain` API (mathjs 15.3.0 Chain parity, #1575 G20).
 */
import type { mathTyped } from '@danielsimonjr/mathts-core';
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';

/** mathjs `Chain` instance type: fluent methods plus unwrap/json members (#1575 G20). */
export type Chain = ChainMethods & ChainUnwrap;

/** Method surface of a `Chain`: each call returns another `Chain`. */
export interface ChainMethods {
  [method: string]: (...args: unknown[]) => Chain;
}

/** Unwrap, stringify, and JSON members of a mathjs `Chain`. */
export interface ChainUnwrap {
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
  toJSON(): { mathjs: 'Chain'; value: unknown };
  type: 'Chain';
  isChain: true;
  value: unknown;
}

type FormatFn = (value: unknown, options?: Record<string, unknown>) => string;
type TypedLike = typeof mathTyped & {
  isTypedFunction: (value: unknown) => boolean;
  resolve: (
    fn: unknown,
    args: unknown[]
  ) => { params: unknown[]; implementation: (...args: unknown[]) => unknown } | null;
};

const { isChain: isChainValue } = factory_mathjsCompat.checks;

interface CompatChainInstance {
  type: 'Chain';
  isChain: true;
  value: unknown;
  done(): unknown;
  valueOf(): unknown;
  toString(): string;
  toJSON(): { mathjs: 'Chain'; value: unknown };
}

/** Constructor for mathjs-compatible `Chain` (callable and `fromJSON`). */
export interface CompatChainCtor {
  new (value?: unknown): CompatChainInstance & Chain;
  fromJSON(json: { value: unknown }): CompatChainInstance & Chain;
}

function chainify(
  wrap: (value?: unknown) => Chain,
  fn: ((...args: unknown[]) => unknown) & { name?: string },
  typed: TypedLike,
  value: unknown,
  rest: unknown[]
): Chain {
  if (rest.length === 0) {
    return wrap(fn(value));
  }
  const args: unknown[] = [value, ...rest];
  if (typed.isTypedFunction(fn)) {
    const sigObject = typed.resolve(fn, args);
    if (sigObject && sigObject.params.length === 1) {
      throw new Error(
        'chain function ' +
          fn.name +
          ' cannot match rest parameter between chain value and additional arguments.'
      );
    }
    const implementation = sigObject?.implementation;
    if (implementation) {
      return wrap(implementation.apply(fn, args));
    }
  }
  return wrap(fn.apply(fn, args));
}

function createLazyProxy(
  prototype: Record<string, unknown>,
  name: string,
  resolver: () => unknown,
  wrap: (value?: unknown) => Chain,
  typed: TypedLike
): void {
  let resolved: ((...args: unknown[]) => Chain) | undefined;
  Object.defineProperty(prototype, name, {
    configurable: true,
    enumerable: false,
    get(): ((...args: unknown[]) => Chain) | undefined {
      if (resolved === undefined) {
        const fn = resolver();
        if (typeof fn !== 'function') {
          return undefined;
        }
        resolved = function resolvedMethod(this: CompatChainInstance, ...rest: unknown[]): Chain {
          return chainify(
            wrap,
            fn as (...args: unknown[]) => unknown & { name?: string },
            typed,
            this.value,
            rest
          );
        };
      }
      return resolved.bind(this);
    },
  });
}

function attachImportProxies(
  ChainCtor: CompatChainCtor,
  on: ((event: string, callback: (...args: unknown[]) => void) => void) | undefined,
  wrap: (value?: unknown) => Chain,
  typed: TypedLike
): void {
  if (!on) return;
  on('import', (name: unknown, resolver: unknown) => {
    if (typeof name !== 'string' || typeof resolver !== 'function') return;
    createLazyProxy(
      ChainCtor.prototype as Record<string, unknown>,
      name,
      resolver as () => unknown,
      wrap,
      typed
    );
  });
}

/** Options for {@link createChain}: instance `format`, `typed`, and import listener. */
export interface CreateChainOptions {
  format?: FormatFn;
  typed?: TypedLike;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
}

/** Read a mathjs `typed` instance from a compat `create(all)` object, if present. */
export function chainTypedFromInstance(value: unknown): TypedLike | undefined {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof Reflect.get(value, 'isTypedFunction') === 'function' &&
    typeof Reflect.get(value, 'resolve') === 'function'
  ) {
    return value as TypedLike;
  }
  return undefined;
}

/** Build `chain` and `Chain` for a compat instance (#1575 G20 D1). */
export function createChain(
  math: Record<string, unknown>,
  options?: CreateChainOptions
): {
  chain: (value?: unknown) => Chain;
  Chain: CompatChainCtor;
} {
  const format: FormatFn =
    options?.format ?? ((value) => String(factory_mathjsCompat.string(value)));
  const typed: TypedLike =
    options?.typed ?? (factory_mathjsCompat.createCompatTyped() as TypedLike);

  class ChainClass implements CompatChainInstance {
    readonly type = 'Chain';
    isChain: true = true;
    value: unknown;

    constructor(value?: unknown) {
      const wrapped = isChainValue(value) ? (value as CompatChainInstance).value : value;
      this.value = wrapped;
    }

    done(): unknown {
      return this.value;
    }

    valueOf(): unknown {
      return this.value;
    }

    toString(): string {
      return format(this.value, {});
    }

    toJSON(): { mathjs: 'Chain'; value: unknown } {
      return {
        mathjs: 'Chain',
        value: this.value,
      };
    }
  }

  ChainClass.prototype.isChain = true;
  Object.defineProperty(ChainClass, 'name', { value: 'Chain', configurable: true });
  const ChainCtor = ChainClass as unknown as CompatChainCtor;

  function allocateChainValue(value?: unknown): ChainClass {
    const inner = Object.create(ChainClass.prototype) as ChainClass;
    const wrapped = isChainValue(value) ? (value as CompatChainInstance).value : value;
    inner.value = wrapped;
    Object.defineProperty(inner, 'type', { value: 'Chain', configurable: true });
    inner.isChain = true;
    return inner;
  }

  function wrapChainValue(value?: unknown): Chain {
    const inner = allocateChainValue(value);
    return new Proxy(inner, {
      get(target, prop, receiver) {
        if (prop === 'constructor') {
          return ChainClass;
        }
        if (typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver);
        }
        if (prop === 'type' || prop === 'isChain' || prop === 'value') {
          return Reflect.get(target, prop, receiver);
        }
        const prototype = ChainClass.prototype as unknown as Record<string, unknown>;
        if (prop in prototype) {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, prop);
          if (descriptor?.get) {
            return descriptor.get.call(target);
          }
          const member = prototype[prop];
          if (typeof member === 'function') {
            return (member as (...args: unknown[]) => unknown).bind(target);
          }
        }
        const fn = math[String(prop)];
        if (typeof fn === 'function') {
          return (...rest: unknown[]) =>
            chainify(
              wrapChainValue,
              fn as (...args: unknown[]) => unknown & { name?: string },
              typed,
              target.value,
              rest
            );
        }
        return undefined;
      },
    }) as Chain;
  }

  ChainCtor.fromJSON = (json: { value: unknown }) => wrapChainValue(json.value);

  attachImportProxies(ChainCtor, options?.on, wrapChainValue, typed);

  function chainNew(this: ChainClass, value?: unknown): Chain {
    if (new.target === undefined) {
      throw new TypeError("Constructor must be called with 'new'");
    }
    return wrapChainValue(value);
  }
  chainNew.prototype = ChainClass.prototype;
  Object.setPrototypeOf(chainNew, ChainClass);
  Object.defineProperty(chainNew, 'name', { value: 'Chain', configurable: true });
  chainNew.fromJSON = ChainCtor.fromJSON;

  return {
    chain: wrapChainValue,
    Chain: chainNew as unknown as CompatChainCtor,
  };
}
