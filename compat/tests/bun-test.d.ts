/** Minimal typing for `bun:test` imports in files that only run under `bun test`. */
declare module 'bun:test' {
  export const mock: {
    module(id: string, factory: () => unknown): void | Promise<void>;
  };
}
