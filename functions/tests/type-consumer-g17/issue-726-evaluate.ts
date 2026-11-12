/** Exact repro from dogfood #726 (GPU types + evaluate) */
import { evaluate } from '@danielsimonjr/mathts-functions';

const v: number = evaluate('1+1');

// @ts-expect-error evaluate(string) is number, not string
const bad: string = evaluate('1+1');

export { v, bad };
