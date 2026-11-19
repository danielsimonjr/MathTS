// The shared command line of the compat generators: write the generated file, or with
// `--check` compare it to the generator output and exit 1 when it differs.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tells whether the script at `scriptPath` is the entry point of this process.
 *
 * @param {string} scriptPath - The absolute path of the script.
 * @returns {boolean} `true` when node runs the script directly.
 */
export function isEntryPoint(scriptPath) {
  return (
    process.argv[1] !== undefined &&
    realpathSync(resolve(process.argv[1])) === realpathSync(scriptPath)
  );
}

/**
 * Writes `outputPath` from `generate`, or with `--check` fails when the file is out of date.
 *
 * @param {string} outputPath - The generated file.
 * @param {() => string | Promise<string>} generate - Renders the file text.
 * @param {string} usage - The script name for the usage message.
 * @returns {Promise<void>}
 */
export async function runGenerator(outputPath, generate, usage) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--check');
  if (unknown.length > 0) {
    console.error('Unknown argument: ' + unknown.join(' ') + '. Usage: ' + usage + ' [--check]');
    process.exit(2);
  }
  const text = await generate();
  if (args.includes('--check')) {
    let current;
    try {
      current = readFileSync(outputPath);
    } catch {
      console.error('Cannot read generated file: ' + outputPath);
      process.exit(1);
      return;
    }
    if (!current.equals(Buffer.from(text, 'utf8'))) {
      console.error('Generated file is out of date: ' + outputPath);
      process.exit(1);
    }
    return;
  }
  writeFileSync(outputPath, text, 'utf8');
}
