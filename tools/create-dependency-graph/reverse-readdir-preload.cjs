// Test helper, loaded with `bun --preload <this file> <script>`. It makes fs.readdirSync return its entries in reverse
// order, so a test can run a generator on a machine that enumerates directories in name order and still see what a
// machine with another enumeration order would produce. It changes no file on disk. On exit it prints how many calls it
// changed, so a test can prove that the preload took effect.
const fs = require('fs');

const original = fs.readdirSync;
let patchedCalls = 0;

fs.readdirSync = function readdirSyncReversed(...args) {
  const entries = original.apply(this, args);
  patchedCalls++;
  return Array.isArray(entries) ? entries.slice().reverse() : entries;
};

process.on('exit', () => {
  process.stderr.write(`reverse-readdir-preload: patched readdirSync calls: ${patchedCalls}\n`);
});
