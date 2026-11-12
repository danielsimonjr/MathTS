/** Exact repro from dogfood #785 */
import { variance } from '@danielsimonjr/mathts-statistics';

const v: number = variance([1, 2, 3, 4]);

export { v };
