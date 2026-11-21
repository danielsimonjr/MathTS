// Type-checks the G17 fixtures of `functions` against the built declarations of ten packages,
// with skipLibCheck: false, under NodeNext and under Node16.
//
// The fixtures were a vitest test (`functions/tests/dogfood-g17-public-types.test.ts`) that
// started two tsc children inside the vitest pool. `bun run test` runs about 48 package
// processes on the same cores, so a tsc child shared them, and the test had a wall-clock limit
// (#1185). A tsc run is a build step, not a unit test: it runs here, alone, in its own CI step
// (job `compile`, after the development build), and it has no time limit of its own.
//
// The verdict of tsc does not depend on the Node that runs it: `types: ["node"]` reads
// `@types/node` from the lockfile, not from the runtime. So the check runs on one Node.
//
// Usage: node tools/test/check-g17-types.mjs [--fixture-dir=<dir>] [--config=<file>]...
//   --fixture-dir  folder that holds the fixtures and the tsconfig files
//                  (default: DEFAULT_FIXTURE_DIR)
//   --config       tsconfig file, relative to the fixture folder (repeatable); a value replaces
//                  the default list DEFAULT_CONFIGS
// Run it with plain `node`: under `bun run` the name `node` resolves to Bun.
// The exit code is 0 when every config compiles with exit code 0 and no output, 1 otherwise.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './workspaces.mjs';

/** The folder of the G17 fixtures. */
export const DEFAULT_FIXTURE_DIR = join(repoRoot, 'functions', 'tests', 'type-consumer-g17');

/** The configs that the check runs, by file name inside the fixture folder. */
export const DEFAULT_CONFIGS = ['tsconfig.json', 'tsconfig.node16.json'];

/**
 * Read the command-line arguments.
 * @param {string[]} argv  arguments after the script name
 * @returns {{fixtureDir: string, configs: string[]}} the resolved settings
 * @throws {Error} on an unknown argument or an empty value
 */
export function parseArgs(argv) {
  let fixtureDir = DEFAULT_FIXTURE_DIR;
  const configs = [];
  for (const arg of argv) {
    const [flag, ...rest] = arg.split('=');
    const value = rest.join('=');
    if ((flag === '--fixture-dir' || flag === '--config') && value === '') {
      throw new Error(`${flag} needs a value: ${flag}=<path>`);
    }
    if (flag === '--fixture-dir') fixtureDir = resolve(value);
    else if (flag === '--config') configs.push(value);
    else throw new Error(`unknown argument ${arg}`);
  }
  return { fixtureDir, configs: configs.length > 0 ? configs : [...DEFAULT_CONFIGS] };
}

/**
 * Find the tsc script of the TypeScript package of this repository.
 * @returns {string} absolute path of `typescript/bin/tsc`
 */
export function resolveTsc() {
  const require = createRequire(join(repoRoot, 'package.json'));
  return join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
}

/**
 * Fail when the fixture folder or a config file does not exist.
 * @param {string} fixtureDir  folder of the fixtures
 * @param {string[]} configs  config file names, relative to the fixture folder
 * @throws {Error} that names the missing path
 */
export function assertInputs(fixtureDir, configs) {
  if (!existsSync(fixtureDir) || !statSync(fixtureDir).isDirectory()) {
    throw new Error(`fixture folder ${fixtureDir} does not exist`);
  }
  for (const config of configs) {
    if (!existsSync(resolve(fixtureDir, config))) {
      throw new Error(`config ${config} does not exist in ${fixtureDir}`);
    }
  }
}

/**
 * Run tsc once on one config and describe the result.
 * @param {string} tsc  absolute path of the tsc script
 * @param {string} fixtureDir  folder of the fixtures
 * @param {string} config  config file name, relative to the fixture folder
 * @returns {{config: string, ok: boolean, report: string}} `ok` is true for exit code 0 and no stdout
 */
export function runTsc(tsc, fixtureDir, config) {
  const result = spawnSync(
    process.execPath,
    [tsc, '-p', resolve(fixtureDir, config), '--pretty', 'false'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const ok = result.status === 0 && result.stdout === '' && !result.error;
  // Report what tsc printed and how it ended; a bare exit code holds neither.
  const report =
    `tsc ${config} failed: code=${result.status} signal=${result.signal}` +
    (result.error ? ` error=${result.error.message}` : '') +
    `\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
  return { config, ok, report };
}

/**
 * Run the check on every config, in sequence.
 * @param {{fixtureDir: string, configs: string[]}} options  the settings from `parseArgs`
 * @returns {{config: string, ok: boolean, report: string}[]} one result per config
 */
export function checkFixtures(options) {
  const { fixtureDir, configs } = options;
  assertInputs(fixtureDir, configs);
  const tsc = resolveTsc();
  return configs.map((config) => runTsc(tsc, fixtureDir, config));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let results;
  try {
    results = checkFixtures(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`check-g17-types: ${err.message}`);
    process.exit(1);
  }
  const failed = results.filter((r) => !r.ok);
  for (const r of failed) console.error(r.report);
  if (failed.length > 0) {
    console.error(`G17 type fixtures: ${failed.length} of ${results.length} configs failed`);
    process.exit(1);
  }
  console.log(`G17 type fixtures: ${results.map((r) => r.config).join(', ')} compile clean`);
}
