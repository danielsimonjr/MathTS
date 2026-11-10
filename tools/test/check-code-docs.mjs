#!/usr/bin/env node
/**
 * Code-docs gate. The script runs `repo-tools docs check <root>` on the whole repository.
 * repo-tools measures the tracked files of the root and applies the `.code-docs.json` of the
 * root, from any start folder.
 *
 * The root is the top level of the git repository that holds this script, unless `--root` is
 * set. The start folder does not change the root: a start outside the repository, or inside a
 * nested git repository, still checks the repository of the script.
 *
 * repo-tools does not measure declaration files (`*.d.ts`), so the gate does not cover the
 * tracked declaration files under the `src` folders and `functions/types`.
 *
 * The command and its arguments come from one config file: `code-docs-gate.json` next to this
 * script. `--config=<path>` or the environment variable `CODE_DOCS_GATE_CONFIG` selects another
 * file. A missing or bad config stops the script.
 *
 * Usage: node tools/test/check-code-docs.mjs [--config=<path>] [--root=<path>]
 * The exit code is the exit code of the check: 0 when no MUST issue is found.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_CONFIG = new URL('./code-docs-gate.json', import.meta.url);

/**
 * Reads and validates the gate config.
 *
 * @param path - Path or file URL of the config file
 * @returns The config: `command` (argv prefix) and `args` (put before the root)
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
 * Runs the check on a repository root.
 *
 * The check starts in the root and receives `.` as its path. The root is never part of the
 * command line, so a shell character in the path of the root cannot change the command.
 *
 * @param root - Repository root; a relative path is read from the start folder
 * @param config - The config from {@link loadConfig}
 * @param stdio - The `stdio` option for the child process
 * @returns The exit code of the check; 1 when the command does not start or gives no exit code
 * @throws An Error when the root is not an existing directory
 */
export function runGate({ root, config, stdio = 'inherit' }) {
  const cwd = resolve(root);
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`code-docs gate: the root ${cwd} is not an existing directory`);
  }
  const [cmd, ...prefix] = config.command;
  const argv = [...prefix, ...config.args, '.'];
  // On Windows the command is a `.cmd` shim, which starts only through the shell. The shell
  // splits an argument at a space, so each such argument of the config gets quotes.
  const viaShell = process.platform === 'win32';
  const result = spawnSync(cmd, viaShell ? argv.map(shellQuote) : argv, {
    cwd,
    stdio,
    shell: viaShell,
  });
  if (result.error) {
    console.error(`code-docs gate: ${cmd} did not start: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

/** Returns the value of the `--<name>=<value>` argument, or undefined when it is not given. */
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
    const scriptDir = dirname(realpathSync(fileURLToPath(import.meta.url)));
    process.exit(runGate({ root: argValue('root') ?? repoRoot(scriptDir), config }));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
