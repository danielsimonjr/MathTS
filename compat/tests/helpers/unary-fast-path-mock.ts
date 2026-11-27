/**
 * Shared module mock for tests/unary-fast-path*. Builds a @danielsimonjr/mathts-functions
 * export object with call counters on unary exports and runWithConfig.
 */
export type UnaryFastPathCounts = { runWithConfig: number; typed: Record<string, number> };

export type UnaryFastPathGlobal = {
  __fpCounts?: UnaryFastPathCounts;
  __fpOrig?: Record<string, unknown>;
};

const WRAPPED = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'log'] as const;

export function buildMockedFunctionsModule(
  orig: Record<string, unknown>,
  g: UnaryFastPathGlobal
): Record<string, unknown> {
  const counts: UnaryFastPathCounts = (g.__fpCounts ??= { runWithConfig: 0, typed: {} });
  const out: Record<string, unknown> = { ...orig };
  for (const k of WRAPPED) {
    const exported = k === 'abs' || k === 'sqrt' ? k : `factory_${k}`;
    const bindings = k === 'sqrt' ? (orig.factory_mathjsCompat as Record<string, unknown>) : orig;
    const targetExports = k === 'sqrt' ? (out.factory_mathjsCompat = { ...bindings }) : out;
    targetExports[exported] = new Proxy(bindings[exported] as (...a: unknown[]) => unknown, {
      apply(target, thisArg, args) {
        counts.typed[k] = (counts.typed[k] ?? 0) + 1;
        return Reflect.apply(target, thisArg, args);
      },
    });
  }
  out.runWithConfig = (...args: unknown[]) => {
    counts.runWithConfig += 1;
    return (orig.runWithConfig as (...a: unknown[]) => unknown)(...args);
  };
  return out;
}
