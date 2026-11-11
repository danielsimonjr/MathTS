import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../ci/apt-install.sh', import.meta.url).pathname;

function makeRoot(name) {
  const root = join(tmpdir(), `apt-install-${name}-${process.pid}-${Date.now()}`);
  const etc = join(root, 'etc', 'apt', 'sources.list.d');
  const bin = join(root, 'bin');
  mkdirSync(etc, { recursive: true });
  mkdirSync(bin, { recursive: true });
  const calls = join(root, 'calls.txt');
  writeFileSync(calls, '');
  const stub = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> ${JSON.stringify(calls)}
etc=${JSON.stringify(join(root, 'etc', 'apt'))}
mode=$(cat ${JSON.stringify(join(root, 'mode'))})
blob=""
if [[ -f $etc/apt-mirrors.txt ]]; then blob+=$(cat "$etc/apt-mirrors.txt"); fi
if [[ -f $etc/sources.list ]]; then blob+=$(cat "$etc/sources.list"); fi
shopt -s nullglob
for f in "$etc"/sources.list.d/*; do
  [[ $f == *.mathts-ci-bak ]] && continue
  blob+=$(cat "$f")
done
if [[ $mode == hard ]]; then
  echo "E: Unable to locate package missing-pkg" >&2
  exit 100
fi
if [[ $mode == ok ]]; then
  echo "Hit:1 http://azure.archive.ubuntu.com/ubuntu noble InRelease" >&2
  exit 0
fi
if [[ $mode == always-dns ]]; then
  echo "E: Failed to fetch https://archive.ubuntu.com/ubuntu noble/InRelease Temporary failure resolving 'archive.ubuntu.com'" >&2
  exit 100
fi
if [[ $blob == *azure.archive.ubuntu.com* || $blob == *no-such.example.invalid* ]]; then
  echo "E: Failed to fetch mirror+file:/etc/apt/apt-mirrors.txt Temporary failure resolving 'azure.archive.ubuntu.com'" >&2
  exit 100
fi
echo "Hit:1 https://archive.ubuntu.com/ubuntu noble InRelease" >&2
exit 0
`;
  const stubPath = join(bin, 'apt-get');
  writeFileSync(stubPath, stub);
  chmodSync(stubPath, 0o755);
  return { root, etc: join(root, 'etc', 'apt'), bin, calls };
}

function run(root, args) {
  return spawnSync('bash', [SCRIPT, ...args], {
    env: {
      ...process.env,
      PATH: `${root.bin}:${process.env.PATH}`,
      MATHTS_APT_ETC: root.etc,
      MATHTS_APT_RETRY_SLEEP: '0',
    },
    encoding: 'utf8',
  });
}

function calls(root) {
  return readFileSync(root.calls, 'utf8').split('\n').filter(Boolean);
}

test('mirror+file list falls back when the azure mirror does not fetch', () => {
  const root = makeRoot('mirrors');
  writeFileSync(join(root.root, 'mode'), 'dns');
  writeFileSync(
    join(root.etc, 'apt-mirrors.txt'),
    'https://azure.archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://archive.ubuntu.com/ubuntu/\tpriority:2\n'
  );
  writeFileSync(
    join(root.etc, 'sources.list.d', 'ubuntu.sources'),
    'Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble noble-updates\nComponents: main universe\n'
  );
  const result = run(root, ['install', 'mesa-vulkan-drivers']);
  assert.equal(result.status, 0, result.stderr);
  const mirrors = readFileSync(join(root.etc, 'apt-mirrors.txt'), 'utf8');
  assert.equal(mirrors.includes('azure.archive.ubuntu.com'), false);
  assert.match(mirrors, /archive\.ubuntu\.com\/ubuntu/);
  assert.match(mirrors, /security\.ubuntu\.com\/ubuntu/);
  const sources = readFileSync(join(root.etc, 'sources.list.d', 'ubuntu.sources'), 'utf8');
  assert.match(sources, /mirror\+file:\/etc\/apt\/apt-mirrors\.txt/);
  assert.equal(calls(root).length, 3);
});

test('deb822 azure URIs are rewritten to the official archives', () => {
  const root = makeRoot('deb822');
  writeFileSync(join(root.root, 'mode'), 'dns');
  writeFileSync(
    join(root.etc, 'sources.list.d', 'ubuntu.sources'),
    [
      'Types: deb',
      'URIs: http://azure.archive.ubuntu.com/ubuntu/',
      'Suites: noble noble-updates',
      'Components: main',
      '',
      'Types: deb',
      'URIs: http://azure.archive.ubuntu.com/ubuntu/',
      'Suites: noble-security',
      'Components: main',
      '',
    ].join('\n')
  );
  const result = run(root, ['update']);
  assert.equal(result.status, 0, result.stderr);
  const sources = readFileSync(join(root.etc, 'sources.list.d', 'ubuntu.sources'), 'utf8');
  assert.equal(sources.includes('azure.archive.ubuntu.com'), false);
  const stanzas = sources.split(/\n\n/);
  const archiveStanza = stanzas.find((stanza) => stanza.includes('noble-updates'));
  const securityStanza = stanzas.find((stanza) => stanza.includes('noble-security'));
  assert.match(archiveStanza, /URIs: https:\/\/archive\.ubuntu\.com\/ubuntu\//);
  assert.match(securityStanza, /URIs: https:\/\/security\.ubuntu\.com\/ubuntu\//);
});

test('legacy one-line sources fall back the same way', () => {
  const root = makeRoot('oneline');
  writeFileSync(join(root.root, 'mode'), 'dns');
  writeFileSync(
    join(root.etc, 'sources.list'),
    [
      'deb http://azure.archive.ubuntu.com/ubuntu noble main',
      'deb http://azure.archive.ubuntu.com/ubuntu noble-security main',
      '',
    ].join('\n')
  );
  const result = run(root, ['update']);
  assert.equal(result.status, 0, result.stderr);
  const sources = readFileSync(join(root.etc, 'sources.list'), 'utf8');
  assert.equal(sources.includes('azure.archive.ubuntu.com'), false);
  assert.match(sources, /deb https:\/\/archive\.ubuntu\.com\/ubuntu\/ noble main/);
  assert.match(sources, /deb https:\/\/security\.ubuntu\.com\/ubuntu\/ noble-security main/);
});

test('DNS failure for the azure mirror switches sources before apt-get', () => {
  const root = makeRoot('dns-preflight');
  writeFileSync(join(root.root, 'mode'), 'dns');
  writeFileSync(
    join(root.etc, 'apt-mirrors.txt'),
    'https://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n'
  );
  writeFileSync(
    join(root.bin, 'getent'),
    `#!/usr/bin/env bash
if [[ "$*" == *azure.archive.ubuntu.com* ]]; then
  exit 1
fi
if [[ "$*" == *archive.ubuntu.com* && "$*" != *us.archive.ubuntu.com* ]]; then
  exit 0
fi
exit 1
`
  );
  chmodSync(join(root.bin, 'getent'), 0o755);
  const result = run(root, ['install', 'mesa-vulkan-drivers']);
  assert.equal(result.status, 0, result.stderr);
  const mirrors = readFileSync(join(root.etc, 'apt-mirrors.txt'), 'utf8');
  assert.equal(mirrors.includes('azure.archive.ubuntu.com'), false);
  assert.match(result.stderr, /does not resolve/);
  assert.equal(calls(root).length, 2);
});

test('a successful apt run that names azure in Hit lines is not a failure', () => {
  const root = makeRoot('hit');
  writeFileSync(join(root.root, 'mode'), 'ok');
  writeFileSync(
    join(root.etc, 'apt-mirrors.txt'),
    'https://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n'
  );
  const result = run(root, ['install', 'libegl1']);
  assert.equal(result.status, 0, result.stderr);
  const mirrors = readFileSync(join(root.etc, 'apt-mirrors.txt'), 'utf8');
  assert.match(mirrors, /azure\.archive\.ubuntu\.com/);
  assert.equal(calls(root).length, 2);
});

test('a missing package fails once and keeps apt exit 100', () => {
  const root = makeRoot('hard');
  writeFileSync(join(root.root, 'mode'), 'hard');
  writeFileSync(
    join(root.etc, 'apt-mirrors.txt'),
    'https://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n'
  );
  const result = run(root, ['install', 'missing-pkg']);
  assert.equal(result.status, 100, result.stderr);
  assert.equal(calls(root).length, 1);
});

test('a mirror that still fails after the official archives exits 100', () => {
  const root = makeRoot('still');
  writeFileSync(join(root.root, 'mode'), 'always-dns');
  writeFileSync(
    join(root.etc, 'apt-mirrors.txt'),
    'https://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n'
  );
  const result = run(root, ['update']);
  assert.equal(result.status, 100, result.stderr);
  assert.equal(calls(root).length, 3);
});

test('install with no packages is a hard error', () => {
  const root = makeRoot('empty');
  writeFileSync(join(root.root, 'mode'), 'ok');
  const result = run(root, ['install']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(calls(root).length, 0);
});
