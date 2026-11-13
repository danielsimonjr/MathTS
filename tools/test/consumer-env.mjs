/**
 * Shared helpers of the packed-consumer checks: entry-point policy, tarball packing and
 * installation into a temporary consumer project. The consumer-side tools (TypeScript,
 * esbuild) are installed in that temporary folder and never become repository dependencies.
 *
 * The temporary folder can instead install published versions from the registry
 * (`registry: true`), which reproduces what an npm user receives today.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/** npm and npx are .cmd files on Windows; a .cmd file runs only through a shell. */
export const shell = process.platform === 'win32';

/** Path of the entry-point policy; `MATHTS_CONSUMER_ENTRIES` overrides it. */
export const ENTRIES_PATH =
  process.env.MATHTS_CONSUMER_ENTRIES ??
  fileURLToPath(new URL('./consumer-entries.json', import.meta.url));

/**
 * Read the entry-point policy. Fails loudly when the file is missing or unreadable.
 * @returns {{ nodeOnly: Record<string,string>, workerScripts: Record<string,string>, requireExempt: Record<string,string>, notBrowserFacing: Record<string,string> }}
 */
export function readEntryPolicy() {
  return JSON.parse(readFileSync(ENTRIES_PATH, 'utf8'));
}

/**
 * Create a scratch folder that is removed when the process ends.
 *
 * A folder of the same `prefix` that is older than `MATHTS_SCRATCH_STALE_HOURS` (default 6) is a
 * leftover of a killed run (a CI timeout, a hard kill) and is removed first. The new folder is
 * removed on normal exit, on `process.exit()`, on an uncaught error and on SIGINT or SIGTERM.
 * A SIGKILL cannot be handled; the sweep of the next run removes that folder.
 * `MATHTS_SCRATCH_ROOT` replaces the parent folder (default: the OS temp folder).
 * @param {string} prefix folder name prefix, for example `mathts-packed-`
 * @param {{ keep?: boolean }} [opts] `keep: true` leaves the folder in place
 * @returns {string} absolute folder path
 */
export function makeScratch(prefix, { keep = false } = {}) {
  const root = process.env.MATHTS_SCRATCH_ROOT ?? tmpdir();
  const staleHours = Number(process.env.MATHTS_SCRATCH_STALE_HOURS ?? 6);
  if (!Number.isFinite(staleHours) || staleHours < 0) {
    throw new Error(
      `MATHTS_SCRATCH_STALE_HOURS must be a number of hours >= 0, got '${process.env.MATHTS_SCRATCH_STALE_HOURS}'`
    );
  }
  const staleMs = staleHours * 3_600_000;
  for (const name of readdirSync(root).filter((n) => n.startsWith(prefix))) {
    const old = join(root, name);
    try {
      if (Date.now() - statSync(old).mtimeMs > staleMs)
        rmSync(old, { recursive: true, force: true });
    } catch (err) {
      console.error(`scratch sweep: cannot remove ${old}: ${err.message}`);
    }
  }
  const dir = mkdtempSync(join(root, prefix));
  if (!keep) {
    const remove = () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        console.error(`scratch cleanup: cannot remove ${dir}: ${err.message}`);
      }
    };
    process.on('exit', remove);
    for (const [signal, code] of [
      ['SIGINT', 130],
      ['SIGTERM', 143],
    ]) {
      process.on(signal, () => process.exit(code));
    }
  }
  return dir;
}

/**
 * Run a command and stream its output.
 * @param {string} cmd executable
 * @param {string[]} argv arguments
 * @param {string} cwd working directory
 */
export function run(cmd, argv, cwd) {
  execFileSync(cmd, argv, { cwd, stdio: 'inherit', shell });
}

/**
 * Public (non-private) workspace packages.
 * @param {string[]} [onlyDirs] limit to these workspace directories
 * @returns {{ dir: string, pkg: Record<string, any> }[]}
 */
export function publicPackages(onlyDirs) {
  return workspaceDirs()
    .filter((dir) => !onlyDirs || onlyDirs.includes(dir))
    .map((dir) => ({
      dir,
      pkg: JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8')),
    }))
    .filter(({ pkg }) => !pkg.private);
}

/**
 * Every public entry point as an import specifier.
 * @param {{ pkg: Record<string, any> }[]} packages
 * @param {{ types?: boolean }} [opts] `types: true` keeps only entries that declare types
 * @returns {string[]}
 */
export function entrySpecifiers(packages, { types = false } = {}) {
  return packages.flatMap(({ pkg }) => {
    const exp = pkg.exports ?? { '.': { types: pkg.types, import: pkg.main } };
    return Object.entries(exp)
      .filter(
        ([sub, target]) => sub !== './package.json' && typeof target === 'object' && target !== null
      )
      .filter(([, target]) =>
        types ? Boolean(target.types) : String(target.import).endsWith('.js')
      )
      .map(([sub]) => (sub === '.' ? pkg.name : `${pkg.name}/${sub.slice(2)}`));
  });
}

/**
 * `npm pack` every given package into a folder.
 * @param {{ dir: string }[]} packages
 * @param {string} dest absolute destination folder
 * @returns {string[]} absolute tarball paths
 */
export function packWorkspace(packages, dest) {
  mkdirSync(dest, { recursive: true });
  for (const { dir } of packages) {
    run(
      'npm',
      ['pack', '--ignore-scripts', '--silent', '--pack-destination', dest],
      join(repoRoot, dir)
    );
  }
  return readdirSync(dest)
    .filter((f) => f.endsWith('.tgz'))
    .map((f) => join(dest, f));
}

/**
 * Install packages into a consumer project.
 * @param {string} consumer absolute project folder (holds package.json)
 * @param {string[]} specs tarball paths, registry specs, and consumer-side tools such as `typescript@5`
 */
export function installInto(consumer, specs) {
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...specs], consumer);
}

/**
 * Version of a repository dev dependency, read from the root `node_modules`.
 * @param {string} name
 * @returns {string}
 */
export function installedVersion(name) {
  return JSON.parse(readFileSync(join(repoRoot, 'node_modules', name, 'package.json'), 'utf8'))
    .version;
}

/**
 * Split tsc output into diagnostics: a line with `error TSnnnn` plus its indented continuation.
 * @param {string} output
 * @returns {string[]}
 */
export function tscDiagnostics(output) {
  return output.split(/\r?\n(?=\S)/).filter((d) => /error TS\d+/.test(d));
}

/**
 * Run `tsc -p .` in a consumer folder.
 * @param {string} consumer
 * @returns {string[]} diagnostics (empty on success)
 */
export function runTsc(consumer) {
  let output = '';
  try {
    output = execFileSync('npx', ['--no-install', 'tsc', '-p', '.'], {
      cwd: consumer,
      encoding: 'utf8',
      shell,
    });
  } catch (err) {
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (!/error TS\d+/.test(output)) throw err; // tsc itself failed to run
  }
  return tscDiagnostics(output);
}
