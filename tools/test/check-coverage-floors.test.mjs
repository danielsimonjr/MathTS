import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkLcovAgainstFloor,
  floorFromMeasured,
  linePercentFromTotals,
  parseLcovLineTotals,
} from './check-coverage-floors.mjs';

test('parseLcovLineTotals sums LF and LH records', () => {
  const text = `TN:
SF:src/a.ts
LF:40
LH:32
SF:src/b.ts
LF:60
LH:48
end_of_record
`;
  assert.deepEqual(parseLcovLineTotals(text), { lf: 100, lh: 80 });
  assert.equal(linePercentFromTotals({ lf: 100, lh: 80 }), 80);
  assert.equal(floorFromMeasured(80), 79);
});

test('checkLcovAgainstFloor passes at floor 79 and fails at 81 for 80% lcov', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cov-floor-'));
  const lcov = join(dir, 'lcov.info');
  writeFileSync(
    lcov,
    `SF:src/x.ts
LF:100
LH:80
end_of_record
`
  );
  assert.equal(checkLcovAgainstFloor(lcov, 79).ok, true);
  const fail = checkLcovAgainstFloor(lcov, 81);
  assert.equal(fail.ok, false);
  assert.match(fail.message ?? '', /<\s*floor\s*81/);
});

test('checkLcovAgainstFloor fails when LF is zero', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cov-floor-'));
  const lcov = join(dir, 'empty.info');
  writeFileSync(lcov, `SF:src/x.ts\nend_of_record\n`);
  const result = checkLcovAgainstFloor(lcov, 0);
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /LF:0/);
});
