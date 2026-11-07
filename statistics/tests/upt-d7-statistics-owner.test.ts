import { describe, it, expect } from 'vitest';
import {
  chiSquaredCDF as fromFunctions,
  normalCDF as normalFunctions,
} from '@danielsimonjr/mathts-functions';
import {
  chiSquaredCDF as fromStatistics,
  normalCDF as normalStatistics,
} from '@danielsimonjr/mathts-statistics';

describe('D7 one distribution owner', () => {
  it('re-exports the functions implementations', () => {
    expect(fromStatistics).toBe(fromFunctions);
    expect(normalStatistics).toBe(normalFunctions);
  });
});
