/** Exact repro from dogfood #785 */
import { variance } from '@danielsimonjr/mathts-statistics';

const v: number = variance([1, 2, 3, 4]);

// @ts-expect-error variance has no string signature
variance('no');

export { v };
