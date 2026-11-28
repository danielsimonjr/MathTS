/** Strip unsafe `clone` overrides from mathjs `config()` updates (#1786). */

export function sanitizeMathjsConfigOptions(options: unknown): unknown[] {
  if (options === null || typeof options !== 'object') return [options];
  const { clone: _ignoredClone, ...rest } = options as Record<string, unknown>;
  return [rest];
}

export function scrubConfigCloneFunction(config: unknown): void {
  if (config === null || typeof config !== 'object') return;
  const record = config as Record<string, unknown>;
  if (typeof record.clone === 'function') {
    delete record.clone;
  }
}
