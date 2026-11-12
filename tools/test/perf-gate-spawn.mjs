/**
 * Spawn isolated Node subprocesses for wall-clock perf gates (G26).
 *
 * Vitest coverage sets NODE_V8_COVERAGE on the worker; inherited children get
 * V8 instrumentation and uneven slowdown. Perf gates must also run with
 * --expose-gc so ABBA samples can flush GC between rounds instead of during
 * a timed arm.
 */
import { execFileSync } from 'node:child_process';

/** Flags required on every perf-gate child Node process. */
export const PERF_GATE_NODE_FLAGS = ['--expose-gc'];

/**
 * Environment for a perf-gate child: no V8 coverage dirs and no vitest worker ids.
 * @returns {NodeJS.ProcessEnv}
 */
export function isolatedPerfGateChildEnv() {
  const env = { ...process.env };
  delete env.NODE_V8_COVERAGE;
  delete env.NODE_V8_COVERAGE_DIR;
  delete env.VITEST;
  delete env.VITEST_WORKER_ID;
  delete env.VITEST_POOL_ID;
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITEST_')) delete env[key];
  }
  return env;
}

/**
 * Run a perf gate script in an isolated Node child and return stdout.
 *
 * @param {string} nodeExe Resolved path to Node (not Bun's shim).
 * @param {string} gateScriptPath Absolute path to the gate `.mjs` script.
 * @param {{ cwd?: string, extraEnv?: Record<string, string> }} [opts]
 * @returns {string} Trimmed stdout (one JSON line).
 */
export function execIsolatedPerfGate(nodeExe, gateScriptPath, opts = {}) {
  const env = isolatedPerfGateChildEnv();
  if (opts.extraEnv) Object.assign(env, opts.extraEnv);
  return execFileSync(nodeExe, [...PERF_GATE_NODE_FLAGS, gateScriptPath], {
    cwd: opts.cwd,
    encoding: 'utf8',
    env,
  }).trim();
}
