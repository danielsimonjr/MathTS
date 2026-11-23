// Find the step of ci.yml that runs a command, so a test can pin a gate that does not run in vitest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './workspaces.mjs';

/**
 * Tell why ci.yml does not gate a command: the command is absent (or commented out), or its step
 * cannot fail the job (`continue-on-error`) or may not run (`if:`).
 * @param {string} command  the exact command line of the step
 * @param {string} [text]  the content of ci.yml; defaults to the file of this checkout
 * @returns {string | null} the reason, or null when a step runs the command as a gate
 */
export function ciStepProblem(command, text) {
  const lines = (text ?? readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8'))
    .replace(/\r/g, '')
    .split('\n');
  const at = lines.findIndex((line) => {
    const body = line.trim().replace(/^run:\s+/, '');
    return body === command;
  });
  if (at < 0) return `ci.yml does not run \`${command}\``;
  let first = at;
  while (first > 0 && !/^ {6}- name:/.test(lines[first] ?? '')) first--;
  let last = at + 1;
  while (last < lines.length && !/^ {6}(?:- |#)|^ {2}[a-z]/.test(lines[last] ?? '')) last++;
  if (/continue-on-error|^\s+if:/m.test(lines.slice(first, last).join('\n'))) {
    return `the step that runs \`${command}\` cannot fail the job or may not run`;
  }
  return null;
}
