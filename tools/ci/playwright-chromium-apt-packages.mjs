#!/usr/bin/env node
/**
 * List apt packages Playwright would install for Chromium on this host
 * (install-deps --dry-run). Uses tools/ci/wrappers/apt-get so mirror fallback
 * applies during the dry-run simulation too.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolsDir, '../..');
const cli = path.join(root, 'node_modules/playwright/cli.js');

if (!existsSync(cli)) {
  console.error(
    'playwright-chromium-apt-packages.mjs: run after `bun install` (missing node_modules/playwright/cli.js)',
  );
  process.exit(1);
}

const wrappers = path.join(toolsDir, 'wrappers');
const pathKey = 'PATH';
const env = { ...process.env };
env[pathKey] = `${wrappers}${path.delimiter}${env[pathKey] ?? ''}`;

const child = spawnSync(process.execPath, [cli, 'install-deps', 'chromium', '--dry-run'], {
  cwd: root,
  encoding: 'utf8',
  env,
});

const out = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
const pkgs = [];
let inList = false;
for (const line of out.split('\n')) {
  if (line.startsWith('Missing system dependencies')) {
    inList = true;
    continue;
  }
  if (inList) {
    const match = /^ {2}(\S+)/.exec(line);
    if (match) {
      pkgs.push(match[1]);
    } else if (line.trim() !== '') {
      inList = false;
    }
  }
}

if (child.status !== 0 && pkgs.length === 0) {
  process.stderr.write(out);
  process.exit(child.status ?? 1);
}

for (const pkg of pkgs) {
  console.log(pkg);
}
