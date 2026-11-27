/**
 * Evaluate hook for {@link createHelpClass}: runs embedded-doc examples with the
 * compat instance evaluator (constants like `version` resolve) while preserving
 * the mathjs `config()` round-trip that `Help.toString()` relies on.
 */
export function createCompatHelpEvaluate(
  evaluate: (expr: string, scope?: Record<string, unknown>) => unknown,
  readLiveConfig?: () => Record<string, unknown>
): (expr: unknown, scope?: Record<string, unknown>) => unknown {
  let savedConfig: Record<string, unknown> = {};
  return (expr, scope) => {
    const text = String(expr).trim();
    if (text === 'config()') {
      if (readLiveConfig) {
        savedConfig = { ...readLiveConfig() };
      }
      return { ...savedConfig };
    }
    if (text.startsWith('config(')) {
      const next = scope && (scope.newConfig ?? scope.originalConfig);
      if (next && typeof next === 'object') savedConfig = { ...(next as Record<string, unknown>) };
      return { ...savedConfig };
    }
    return evaluate(text, scope);
  };
}
