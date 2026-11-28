/**
 * Live expression math scope view (mirrors expression `expressionView`) for compat (#1786).
 */
import { EXPRESSION_SCOPE_OMIT } from '@danielsimonjr/mathts-expression';

const expressionViews = new WeakMap<object, Record<string, unknown>>();

/** Hide expression denylist names while forwarding live reads to the caller scope. */
export function compatExpressionView(scope: Record<string, unknown>): Record<string, unknown> {
  let view = expressionViews.get(scope);
  if (view !== undefined) return view;
  const hidden = (key: string | symbol): boolean =>
    typeof key === 'string' && EXPRESSION_SCOPE_OMIT.has(key);
  view = new Proxy({} as Record<string, unknown>, {
    get: (_t, key) => (hidden(key) ? undefined : Reflect.get(scope, key)),
    has: (_t, key) => !hidden(key) && Reflect.has(scope, key),
    set: (_t, key, value) => !hidden(key) && Reflect.set(scope, key, value),
    deleteProperty: (_t, key) => !hidden(key) && Reflect.deleteProperty(scope, key),
    ownKeys: () => Reflect.ownKeys(scope).filter((key) => !hidden(key)),
    getOwnPropertyDescriptor: (_t, key) => {
      if (hidden(key)) return undefined;
      const descriptor = Reflect.getOwnPropertyDescriptor(scope, key);
      return descriptor === undefined ? undefined : { ...descriptor, configurable: true };
    },
    getPrototypeOf: () => Reflect.getPrototypeOf(scope),
  });
  expressionViews.set(scope, view);
  return view;
}
