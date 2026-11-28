#!/usr/bin/env node
/**
 * One-shot port: mathjs 15.3.0 algebra sources → compat/src/mathjs-symbolic-algebra/*.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const MATHJS = '/tmp/mathjs-15.3.0/src/function/algebra';
const OUT = path.resolve('src/mathjs-symbolic-algebra');

const factoryHeader = `import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
const factory = factory_mathjsCompat.factory;
`;

const FILES = [
  {
    src: 'simplify/wildcards.js',
    out: 'simplify/wildcards.ts',
    header: `import {
  isConstantNode,
  isFunctionNode,
  isOperatorNode,
  isParenthesisNode,
} from '@danielsimonjr/mathts-functions';

export { isConstantNode, isSymbolNode as isVariableNode } from '@danielsimonjr/mathts-functions';

`,
    rename: null,
  },
  {
    src: 'simplify/util.js',
    out: 'simplify/util.ts',
    header: `import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { isFunctionNode, isOperatorNode, isParenthesisNode } from '@danielsimonjr/mathts-functions';
import { hasOwnProperty } from '@danielsimonjr/mathts-core/internal';

const factory = factory_mathjsCompat.factory;

`,
    rename: { createUtil: 'createMathjsSimplifyUtil' },
  },
  {
    src: 'simplifyCore.js',
    out: 'simplifyCore.ts',
    header: `${factoryHeader}import {
  isAccessorNode,
  isArrayNode,
  isConstantNode,
  isFunctionNode,
  isIndexNode,
  isObjectNode,
  isOperatorNode,
} from '@danielsimonjr/mathts-functions';
import { getOperator } from '../mathjs-operators.js';
import { createMathjsSimplifyUtil as createUtil } from './simplify/util.js';

`,
    rename: { createSimplifyCore: 'createMathjsSimplifyCore' },
  },
  {
    src: 'resolve.js',
    out: 'resolve.ts',
    header: `${factoryHeader}import {
  isFunctionNode,
  isNode,
  isOperatorNode,
  isParenthesisNode,
  isSymbolNode,
} from '@danielsimonjr/mathts-functions';
import { createMap } from '@danielsimonjr/mathts-core/internal';

`,
    rename: { createResolve: 'createMathjsResolve' },
  },
  {
    src: 'derivative.js',
    out: 'derivative.ts',
    header: `${factoryHeader}import { isConstantNode } from '@danielsimonjr/mathts-functions';
import { safeNumberType, typeOf } from '../mathjs-is.js';

`,
    rename: { createDerivative: 'createMathjsDerivative' },
  },
  {
    src: 'simplify.js',
    out: 'simplify.ts',
    header: `${factoryHeader}import { isParenthesisNode, replacer } from '@danielsimonjr/mathts-functions';
import { createEmptyMap, createMap, hasOwnProperty } from '@danielsimonjr/mathts-core/internal';
import {
  isConstantNode,
  isConstantExpression,
  isNumericNode,
  isVariableNode,
} from './simplify/wildcards.js';
import { createMathjsSimplifyUtil as createUtil } from './simplify/util.js';

`,
    rename: { createSimplify: 'createMathjsSimplify' },
  },
];

for (const { src, out, header, rename } of FILES) {
  const raw = fs.readFileSync(path.join(MATHJS, src), 'utf8');
  let body = raw.replace(/^import[^\n]*\n/gm, '').trimStart();
  if (rename) {
    for (const [from, to] of Object.entries(rename)) {
      body = body.replace(
        `export const ${from} =`,
        `/** mathjs 15.3.0 \`${from}\` port for compat (#1790). */\nexport const ${to} =`
      );
    }
  }
  const dest = path.join(OUT, out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${header}\n${body}`);
  console.log('wrote', dest);
}