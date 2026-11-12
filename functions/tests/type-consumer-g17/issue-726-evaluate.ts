/** Exact repro from dogfood #726 (GPU types + evaluate) */
import { evaluate } from '@danielsimonjr/mathts-functions';

const v: number = evaluate('1+1');

export { v };
