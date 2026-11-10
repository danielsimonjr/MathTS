#!/usr/bin/env node
/**
 * Code-docs gate. The script lists the tracked files that match the include patterns, then runs
 * `repo-tools docs check` on that list. The working directory of the check is the repository
 * root, because repo-tools reads `.code-docs.json` from the working directory only. The root is
 * the top level of the git repository that holds the current directory, unless `--root` is set.
 *
 * Declaration files (`*.d.ts`) are outside the gate: repo-tools does not measure them, and the
 * include patterns leave them out so that the verdict covers every listed file.
 *
 * The include patterns, the command and its arguments come from one config file:
 * `code-docs-gate.json` next to this script. `--config=<path>` or the environment variable
 * `CODE_DOCS_GATE_CONFIG` selects another file. A missing or bad config stops the script.
 *
 * Usage: node tools/test/check-code-docs.mjs [--config=<path>] [--root=<path>]
 * The exit code is the exit code of the check: 0 when no MUST issue is found.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CONFIG = new URL('./code-docs-gate.json', import.meta.url);

/**
 * Reads and validates the gate config.
 *
 * @param path - Path or file URL of the config file
 * @returns The config: `include` (git pathspecs), `command` (argv prefix) and `args`
 * @throws An Error when the file is missing, is not JSON, or lacks a field
 */
export function loadConfig(path) {
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`code-docs gate config ${String(path)} cannot be read: ${err.message}`);
  }
  const isStrings = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string');
  if (!isStrings(config.include) || config.include.length === 0) {
    throw new Error(
      `code-docs gate config ${String(path)}: "include" must be a non-empty string array`
    );
  }
  if (!isStrings(config.command) || config.command.length === 0) {
    throw new Error(
      `code-docs gate config ${String(path)}: "command" must be a non-empty string array`
    );
  }
  if (!isStrings(config.args)) {
    throw new Error(`code-docs gate config ${String(path)}: "args" must be a string array`);
  }
  return config;
}

/**
 * Lists the tracked files of a repository that match git pathspecs.
 *
 * @param root - Repository root
 * @param include - Git pathspecs, for example `:(glob)*\/src/**` or `:(exclude,glob)**\/*.d.ts`
 * @returns Repository-relative paths with forward slashes
 */
export function listPaths(root, include) {
  const out = execFileSync('git', ['ls-files', '-z', '--', ...include], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split('\0').filter(Boolean);
}

/**
 * Finds the top level of the git repository that holds a directory.
 *
 * @param cwd - A directory in the repository
 * @returns The absolute path of the repository root
 * @throws An Error when the directory is not in a git repository
 */
export function repoRoot(cwd) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Quotes an argument for the Windows command shell when it holds a space. */
function shellQuote(arg) {
  return /\s/.test(arg) ? `"${arg}"` : arg;
}

/**
 * Runs the check on the tracked files that the config includes.
 *
 * @param options - `root` (repository root), `config` (from {@link loadConfig}) and `stdio` for the child
 * @returns The exit code of the check; 1 when the include patterns match no file
 */
export function runGate({ root, config, stdio = 'inherit' }) {
  const paths = listPaths(root, config.include);
  if (paths.length === 0) {
    console.error('code-docs gate: the include patterns match no tracked file');
    return 1;
  }
  const dir = mkdtempSync(join(tmpdir(), 'code-docs-gate-'));
  try {
    const list = join(dir, 'paths.txt');
    writeFileSync(list, paths.join('\n') + '\n');
    const [cmd, ...prefix] = config.command;
    const argv = [...prefix, ...config.args, `--paths-from=${list}`];
    // On Windows the command is a `.cmd` shim, which starts only through the shell. The shell
    // splits an argument at a space, so each such argument gets quotes.
    const viaShell = process.platform === 'win32';
    const result = spawnSync(cmd, viaShell ? argv.map(shellQuote) : argv, {
      cwd: root,
      stdio,
      shell: viaShell,
    });
    if (result.error) {
      console.error(`code-docs gate: ${cmd} did not start: ${result.error.message}`);
      return 1;
    }
    return result.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function argValue(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
}

/** Is true when this file is the script that node started, also through a link or a junction. */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const configPath = argValue('config') ?? process.env.CODE_DOCS_GATE_CONFIG ?? DEFAULT_CONFIG;
  try {
    const config = loadConfig(configPath);
    process.exit(runGate({ root: argValue('root') ?? repoRoot(process.cwd()), config }));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
