/**
 * Registers {@link ./mathjs-unit-oracle-loader.mjs} for `node --import`.
 */

import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const loader = join(here, 'mathjs-unit-oracle-loader.mjs');
register(loader, import.meta.url);