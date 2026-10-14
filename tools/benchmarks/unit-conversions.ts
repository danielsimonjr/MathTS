/**
 * Unit conversion benchmark (exact-scale engine).
 *
 * Runs the hot unit paths straight from source with Bun:
 *
 *   bun tools/benchmarks/unit-conversions.ts            # this checkout
 *   bun tools/benchmarks/unit-conversions.ts <core/src>  # another checkout, for comparison
 *
 * Each row reports the median of several timed rounds after a warm-up.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? resolve(import.meta.dir, '../../core/src'));
const { Unit } = await import(pathToFileURL(resolve(root, 'types/unit/index.ts')).href);

const ROUNDS = 7;
const N = 20_000;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function row(name: string, fn: (i: number) => unknown): void {
  for (let i = 1; i <= N; i++) fn(i); // warm-up
  const times: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const start = performance.now();
    for (let i = 1; i <= N; i++) fn(i);
    times.push(performance.now() - start);
  }
  const ms = median(times);
  console.log(
    `${name.padEnd(34)} ${ms.toFixed(1).padStart(9)} ms / ${N} ops  ${(((N / ms) * 1000) / 1e3).toFixed(0).padStart(6)} K/s`
  );
}

console.log(`source: ${root}`);
row('new Unit(i, "psi")', (i) => new Unit(i, 'psi'));
row('psi -> Pa toNumber', (i) => new Unit(i, 'psi').toNumber('Pa'));
row('mi/h -> km/h toNumber', (i) => new Unit(i, 'mi/h').toNumber('km/h'));
row('degF -> degC toNumber', (i) => new Unit(i, 'degF').toNumber('degC'));
row('kg*m/s^2 -> lbf toNumber', (i) => new Unit(i, 'kg*m/s^2').toNumber('lbf'));
row('deg -> rad toNumber', (i) => new Unit(i, 'deg').toNumber('rad'));
