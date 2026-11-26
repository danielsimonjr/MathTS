/**
 * `createChain` — the GC12 fluent `chain` API factory (mathjs 15.3.0 Chain
 * parity, #1575 G20), split beside the method helpers in
 * {@link ./chain-methods.ts}.
 */
import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { attachImportProxies, chainify } from './chain-methods.js';
import type {
  Chain,
  CompatChainCtor,
  CompatChainInstance,
  CreateChainOptions,
  FormatFn,
  TypedLike,
} from './chain-types.js';

const { isChain: isChainValue } = factory_mathjsCompat.checks;

/** Reads the typed dispatcher off a math-like instance when one is available, so
 * `createChain` can resolve methods against the instance's own typed functions
 * instead of a fresh compat dispatcher. Returns `undefined` when `value` exposes
 * no `isTypedFunction`/`resolve` pair. */
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

/** Builds the mathjs-style fluent `chain` API over a math-like namespace: returns
 * the `chain(value)` factory and the named `Chain` constructor, with lazy method
 * proxies for every function of the namespace (and functions added later via the
 * instance's `import` event when `options.on` is given). */
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
      throw new SyntaxError('Constructor must be called with the new operator');
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
