import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BUN_AUDIT_ARGS,
  DEFAULT_IGNORE_FILE,
  buildAuditArgs,
  classifyAttempt,
  loadIgnores,
  runAudits,
  runAuditWithRetry,
} from './bun-audit-retry.mjs';

async function withFile(text, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-ignore-'));
  const file = join(dir, 'ignore.json');
  if (text !== null) writeFileSync(file, text);
  try {
    return await fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ENTRY = {
  id: 'GHSA-fc5q-39xc-vjpf',
  package: 'picomatch',
  reason: 'r',
  remove: 'x',
  issue: 1,
};

test('the committed ignore file loads, and each entry names an issue', () => {
  const ignores = loadIgnores(DEFAULT_IGNORE_FILE);
  for (const entry of ignores) assert.equal(typeof entry.issue, 'number');
});

test('loadIgnores throws on a missing file, bad JSON, no array, a missing field or a bad id', async () => {
  await withFile(null, (f) => assert.throws(() => loadIgnores(f), /cannot read/));
  await withFile('{', (f) => assert.throws(() => loadIgnores(f), /cannot read/));
  await withFile('{}', (f) => assert.throws(() => loadIgnores(f), /no "ignores" array/));
  for (const field of ['id', 'package', 'reason', 'remove', 'issue']) {
    const entry = { ...ENTRY };
    delete entry[field];
    await withFile(JSON.stringify({ ignores: [entry] }), (f) =>
      assert.throws(() => loadIgnores(f), new RegExp(`no "${field}"`))
    );
  }
  await withFile(JSON.stringify({ ignores: [{ ...ENTRY, id: 'CVE-2026-1' }] }), (f) =>
    assert.throws(() => loadIgnores(f), /not a GHSA id/)
  );
});

test('buildAuditArgs: the full tree takes each ignore; the production audit takes none', () => {
  assert.deepEqual(buildAuditArgs([ENTRY]), [...BUN_AUDIT_ARGS, '--ignore=GHSA-fc5q-39xc-vjpf']);
  assert.deepEqual(buildAuditArgs([ENTRY], { production: true }), [...BUN_AUDIT_ARGS, '--prod']);
  assert.deepEqual(buildAuditArgs([]), BUN_AUDIT_ARGS);
});

test('runAudits runs both audits and fails when either fails', async () => {
  await withFile(JSON.stringify({ ignores: [ENTRY] }), async (f) => {
    const seen = [];
    const ok = await runAudits({ ignoreFile: f, run: async (a) => (seen.push(a), 0) });
    assert.equal(ok, 0);
    assert.deepEqual(seen, [
      buildAuditArgs([ENTRY]),
      buildAuditArgs([ENTRY], { production: true }),
    ]);
    const prodFails = await runAudits({
      ignoreFile: f,
      run: async (a) => (a.includes('--prod') ? 1 : 0),
    });
    assert.equal(prodFails, 1);
    const fullFails = await runAudits({
      ignoreFile: f,
      run: async (a) => (a.includes('--prod') ? 0 : 1),
    });
    assert.equal(fullFails, 1);
  });
});

test('runAuditWithRetry passes its args to the default runner', async () => {
  const code = await runAuditWithRetry({ args: ['--version'], backoffMs: [0, 0] });
  assert.equal(code, 0);
});

test('BUN_AUDIT_ARGS keeps the high floor', () => {
  assert.deepEqual(BUN_AUDIT_ARGS, ['audit', '--audit-level=high']);
});

test('classify: exit 0 is ok', () => {
  assert.equal(classifyAttempt({ exitCode: 0, stderr: '' }), 'ok');
});

test('classify: advisory stderr without outage pattern is advisory', () => {
  assert.equal(
    classifyAttempt({ exitCode: 1, stderr: '1 high severity vulnerability found' }),
    'advisory'
  );
});

test('classify: 503 in stderr is outage', () => {
  assert.equal(classifyAttempt({ exitCode: 1, stderr: 'HTTP 503 Service Unavailable' }), 'outage');
});

test('classify: bun-native ConnectionRefused and DNSResolveFailed are outage', () => {
  assert.equal(
    classifyAttempt({
      exitCode: 1,
      stderr:
        'error: POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - ConnectionRefused',
    }),
    'outage'
  );
  assert.equal(
    classifyAttempt({
      exitCode: 1,
      stderr:
        'error: POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - DNSResolveFailed',
    }),
    'outage'
  );
});

test('classify: timeout and spawn errors are outage', () => {
  assert.equal(classifyAttempt({ exitCode: null, stderr: '', timedOut: true }), 'outage');
  assert.equal(
    classifyAttempt({ exitCode: null, stderr: 'spawn ENOENT', spawnError: new Error('ENOENT') }),
    'outage'
  );
});

test('classify: timedOut wins over exit 0', () => {
  assert.equal(classifyAttempt({ exitCode: 0, stderr: '', timedOut: true }), 'outage');
});

test('classify: unknown non-zero exit without outage pattern is advisory (conservative)', () => {
  assert.equal(classifyAttempt({ exitCode: 2, stderr: 'internal parser failure' }), 'advisory');
});

test('classify: 503 in advisory stdout is not an outage', () => {
  assert.equal(
    classifyAttempt({
      exitCode: 1,
      stdout: 'CVE-2024-50379 lodash prototype pollution',
      stderr: '1 high severity vulnerability found',
    }),
    'advisory'
  );
});

test('success on first attempt spawns once', async () => {
  let calls = 0;
  const code = await runAuditWithRetry({
    backoffMs: [0, 0],
    runOnce: async () => {
      calls++;
      return { exitCode: 0, stderr: '' };
    },
  });
  assert.equal(code, 0);
  assert.equal(calls, 1);
});

test('advisory fails immediately without retry', async () => {
  let calls = 0;
  const code = await runAuditWithRetry({
    backoffMs: [0, 0],
    runOnce: async () => {
      calls++;
      return { exitCode: 1, stderr: 'high: lodash prototype pollution' };
    },
  });
  assert.equal(code, 1);
  assert.equal(calls, 1);
});

test('outage then success spawns twice', async () => {
  let calls = 0;
  const code = await runAuditWithRetry({
    backoffMs: [0, 0],
    runOnce: async () => {
      calls++;
      if (calls === 1) return { exitCode: 1, stderr: 'registry returned 503' };
      return { exitCode: 0, stderr: '' };
    },
  });
  assert.equal(code, 0);
  assert.equal(calls, 2);
});

test('three outages fail after three attempts', async () => {
  let calls = 0;
  const code = await runAuditWithRetry({
    backoffMs: [0, 0],
    runOnce: async () => {
      calls++;
      return { exitCode: 1, stderr: '502 Bad Gateway' };
    },
  });
  assert.equal(code, 1);
  assert.equal(calls, 3);
});

test('timeout counts as outage and retries', async () => {
  let calls = 0;
  const code = await runAuditWithRetry({
    backoffMs: [0, 0],
    runOnce: async () => {
      calls++;
      if (calls < 3) return { exitCode: null, stderr: '', timedOut: true };
      return { exitCode: 0, stderr: '' };
    },
  });
  assert.equal(code, 0);
  assert.equal(calls, 3);
});

test('unknown failure does not retry', async () => {
  let calls = 0;
  const code = await runAuditWithRetry({
    backoffMs: [0, 0],
    runOnce: async () => {
      calls++;
      return { exitCode: 99, stderr: 'audit subprocess crashed' };
    },
  });
  assert.equal(code, 1);
  assert.equal(calls, 1);
});

test('advisory stdout is forwarded and not retried into a pass', async () => {
  let calls = 0;
  const chunks = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => {
    chunks.push(String(chunk));
    return origWrite(chunk, ...rest);
  };
  try {
    const code = await runAuditWithRetry({
      backoffMs: [0, 0],
      runOnce: async () => {
        calls++;
        if (calls > 1) return { exitCode: 0, stderr: '' };
        return {
          exitCode: 1,
          stdout: 'high: lodash prototype pollution\n',
          stderr: '',
        };
      },
    });
    assert.equal(code, 1);
    assert.equal(calls, 1);
    assert.match(chunks.join(''), /high: lodash prototype pollution/);
  } finally {
    process.stdout.write = origWrite;
  }
});
