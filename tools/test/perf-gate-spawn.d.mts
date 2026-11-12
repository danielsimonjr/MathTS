export declare const PERF_GATE_NODE_FLAGS: readonly ['--expose-gc'];

export declare function isolatedPerfGateChildEnv(): NodeJS.ProcessEnv;

export declare function execIsolatedPerfGate(
  nodeExe: string,
  gateScriptPath: string,
  opts?: {
    cwd?: string;
    extraEnv?: Record<string, string>;
  }
): string;
