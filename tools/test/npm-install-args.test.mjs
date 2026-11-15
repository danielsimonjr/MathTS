/**
 * Tests of `npmInstallArgs` (consumer-env.mjs): the npm arguments of a consumer install. npm's
 * default `fetch-timeout` is 300000 ms, the same as the limit of the slowest consumer test. So one
 * stalled registry request used the whole budget of that test. The install now sets its own
 * bounded fetch timeout and retries. Run with `node --test` (never `bun run`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { npmInstallArgs } from './consumer-env.mjs';

describe('npmInstallArgs', () => {
  it('sets a bounded fetch timeout and retries by default', () => {
    const args = npmInstallArgs(['typescript@5', 'a.tgz'], {});
    assert.ok(args.includes('--fetch-timeout=60000'), args.join(' '));
    assert.ok(args.includes('--fetch-retries=4'), args.join(' '));
    assert.deepEqual(args.slice(0, 1), ['install']);
    assert.deepEqual(args.slice(-2), ['typescript@5', 'a.tgz']);
  });

  it('takes the limits from the environment', () => {
    const args = npmInstallArgs(['x.tgz'], {
      MATHTS_CONSUMER_NPM_FETCH_TIMEOUT_MS: '15000',
      MATHTS_CONSUMER_NPM_FETCH_RETRIES: '0',
    });
    assert.ok(args.includes('--fetch-timeout=15000'), args.join(' '));
    assert.ok(args.includes('--fetch-retries=0'), args.join(' '));
  });

  it('refuses a limit that is not a whole number', () => {
    for (const bad of ['', 'abc', '-1', '1.5']) {
      assert.throws(
        () => npmInstallArgs([], { MATHTS_CONSUMER_NPM_FETCH_TIMEOUT_MS: bad }),
        /MATHTS_CONSUMER_NPM_FETCH_TIMEOUT_MS/
      );
    }
    assert.throws(
      () => npmInstallArgs([], { MATHTS_CONSUMER_NPM_FETCH_TIMEOUT_MS: '0' }),
      /MATHTS_CONSUMER_NPM_FETCH_TIMEOUT_MS/
    );
  });
});
