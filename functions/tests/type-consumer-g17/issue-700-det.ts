/** Exact repro from dogfood #700 */
import { det } from '@danielsimonjr/mathts-functions';

const d: number = det([
  [1, 2],
  [3, 4],
]);

export { d };
