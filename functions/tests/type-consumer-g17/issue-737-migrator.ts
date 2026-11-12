/** Exact repro from dogfood #737 */
import { create, all } from '@danielsimonjr/mathts-compat';
import { sin } from '@danielsimonjr/mathts-trigonometry';

const math = create(all);
const n: number = math.add(1, 2);
const s: number = sin(0);

// @ts-expect-error add(number, number) is number, not string
const bad: string = math.add(1, 2);

export { n, s, bad };
