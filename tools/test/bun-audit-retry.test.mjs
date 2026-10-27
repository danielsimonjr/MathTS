import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUN_AUDIT_ARGS,
  classifyAttempt,
  runAuditWithRetry,
} from './bun-audit-retry.mjs';

test('BUN_AUDIT_ARGS keeps the high floor', () => {
  assert.deepEqual(BUN_AUDIT_ARGS, ['audit', '--audit-level=high']);
});

test('classify: exit 0 is ok', () => {
  assert.equal(classifyAttempt({ exitCode: 0, stderr: '' }), 'ok');
});

test('classify: advisory stderr without outage pattern is advisory', () => {
  assert.equal(
    classifyAttempt({ exitCode: 1, stderr: '1 high severity vulnerability found' }),
    'advisory',
  );
});

test('classify: 503 in stderr is outage', () => {
  assert.equal(classifyAttempt({ exitCode: 1, stderr: 'HTTP 503 Service Unavailable' }), 'outage');
});

test('classify: timeout and spawn errors are outage', () => {
  assert.equal(classifyAttempt({ exitCode: null, stderr: '', timedOut: true }), 'outage');
  assert.equal(
    classifyAttempt({ exitCode: null, stderr: 'spawn ENOENT', spawnError: new Error('ENOENT') }),
    'outage',
  );
});

test('classify: unknown non-zero exit without outage pattern is advisory (conservative)', () => {
  assert.equal(classifyAttempt({ exitCode: 2, stderr: 'internal parser failure' }), 'advisory');
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
