#!/usr/bin/env node
/**
 * Strict consumer typecheck of packed functions/matrix/linalg WITHOUT @types/node.
 * Regression gate for dogfood #697 (workerpool Node types leaking into consumers).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './workspaces.mjs';

const PACKS = ['core', 'matrix', 'parallel', 'packages/workerpool', 'functions', 'linalg'];
const WORKERPOOL_VENDOR = 'workerpool';
const skipBuild = process.argv.includes('--skip-build');

if (!skipBuild) {
  execFileSync('npx', ['turbo', 'build', ...PACKS.flatMap((d) => ['--filter', `./${d}`])], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

const work = mkdtempSync(join(tmpdir(), 'mathts-no-node-'));
const tarballs = join(work, 'tarballs');
const consumer = join(work, 'consumer');
mkdirSync(tarballs);

try {
  for (const dir of PACKS) {
    execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--silent', '--pack-destination', tarballs],
      { cwd: join(repoRoot, dir), stdio: 'inherit' }
    );
  }
  // Packed @danielsimonjr/mathts-* tarballs still depend on registry workerpool; ship the
  // patched fork the monorepo installs so #697 is tested against the same types consumers
  // receive once the workerpool fork release ships this patch.
  execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--silent', '--pack-destination', tarballs],
    { cwd: join(repoRoot, 'node_modules', WORKERPOOL_VENDOR), stdio: 'inherit' }
  );
  const tgz = readdirSync(tarballs).filter((f) => f.endsWith('.tgz'));
  const wpTgz = tgz.find((f) => /workerpool-10/.test(f));
  if (!wpTgz) throw new Error('consumer-typecheck-no-node: missing patched workerpool pack');
  const tsVersion = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules/typescript/package.json'), 'utf8')
  ).version;

  mkdirSync(consumer);
  mkdirSync(join(consumer, 'src'));
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'mathts-consumer-no-node',
        private: true,
        type: 'module',
        overrides: { workerpool: `file:${join(tarballs, wpTgz)}` },
      },
      null,
      2
    )
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          target: 'ES2022',
          lib: ['ESNext', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
        include: ['src'],
      },
      null,
      2
    )
  );
  writeFileSync(
    join(consumer, 'src', 'consumer.ts'),
    `import { det } from '@danielsimonjr/mathts-functions';\nconst d: number = det([[1, 2], [3, 4]]);\nexport { d };\n`
  );

  execFileSync(
    'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--loglevel=error',
        `typescript@${tsVersion}`,
        ...tgz.filter((f) => f !== wpTgz).map((f) => join(tarballs, f)),
      ],
    { cwd: consumer, stdio: 'inherit' }
  );

  let output = '';
  try {
    execFileSync('npx', ['--no-install', 'tsc', '-p', '.'], { cwd: consumer, stdio: 'pipe' });
  } catch (err) {
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (!/error TS\d+/.test(output)) throw err;
  }

  if (/error TS\d+/.test(output)) {
    console.error(output);
    console.error('consumer-typecheck-no-node: FAIL');
    process.exit(1);
  }
  console.log('consumer-typecheck-no-node: PASS');
} finally {
  rmSync(work, { recursive: true, force: true });
}
