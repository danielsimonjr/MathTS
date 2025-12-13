/**
 * mathjs Migration Example
 *
 * Shows how to migrate from mathjs to MathTS using the compat layer.
 *
 * Run: npx tsx examples/mathjs-migration.ts
 */

// Step 1: Just change the import!
// Before: import { create, all } from 'mathjs';
import { create, all } from '@mathts/compat';

const math = create(all);

console.log('=== mathjs to MathTS Migration ===\n');

// All your existing mathjs code continues to work:

// Arithmetic
console.log('--- Arithmetic ---');
console.log('math.add(1, 2) =', math.add(1, 2));
console.log('math.multiply(3, 4) =', math.multiply(3, 4));
console.log('math.pow(2, 8) =', math.pow(2, 8));
console.log('math.sqrt(16) =', math.sqrt(16));

// Trigonometry
console.log('\n--- Trigonometry ---');
console.log('math.sin(0) =', math.sin(0));
console.log('math.cos(0) =', math.cos(0));
console.log('math.tan(math.pi / 4) =', math.tan(math.pi / 4));

// Complex numbers
console.log('\n--- Complex Numbers ---');
const z = math.complex(3, 4);
console.log('math.complex(3, 4) =', z.toString());
console.log('math.abs(z) =', math.abs(z));
console.log('math.conj(z) =', math.conj(z).toString());
console.log('math.re(z) =', math.re(z));
console.log('math.im(z) =', math.im(z));
console.log('math.arg(z) =', math.arg(z));

// Fractions
console.log('\n--- Fractions ---');
const f = math.fraction(1, 3);
console.log('math.fraction(1, 3) =', f.toString());
const f2 = math.fraction(1, 6);
console.log('math.add(1/3, 1/6) =', math.add(f, f2).toString());

// BigNumbers
console.log('\n--- BigNumbers ---');
const bn1 = math.bignumber('0.1');
const bn2 = math.bignumber('0.2');
console.log('math.add(0.1, 0.2) as BigNumber =', math.add(bn1, bn2).toString());

// Matrices
console.log('\n--- Matrices ---');
const m = math.matrix([
  [1, 2],
  [3, 4],
]);
console.log('math.matrix([[1,2],[3,4]]):');
console.log('  rows:', m.rows, 'cols:', m.cols);
console.log('  element (0,1):', m.get(0, 1));

console.log('\nmath.det(m) =', math.det(m));
console.log('math.transpose(m):');
const t = math.transpose(m);
console.log('  [[' + t.get(0, 0) + ',' + t.get(0, 1) + '],[' + t.get(1, 0) + ',' + t.get(1, 1) + ']]');

const I2 = math.identity(2);
console.log('\nmath.identity(2):');
console.log('  [[' + I2.get(0, 0) + ',' + I2.get(0, 1) + '],[' + I2.get(1, 0) + ',' + I2.get(1, 1) + ']]');

const z2x3 = math.zeros(2, 3);
console.log('\nmath.zeros(2, 3):');
console.log('  size:', math.size(z2x3));

// Statistics
console.log('\n--- Statistics ---');
const data = [1, 2, 3, 4, 5];
console.log('data =', data);
console.log('math.sum(data) =', math.sum(data));
console.log('math.mean(data) =', math.mean(data));
console.log('math.min(data) =', math.min(data));
console.log('math.max(data) =', math.max(data));

// Number theory
console.log('\n--- Number Theory ---');
console.log('math.gcd(12, 18) =', math.gcd(12, 18));
console.log('math.lcm(4, 6) =', math.lcm(4, 6));

// Rounding
console.log('\n--- Rounding ---');
console.log('math.round(2.567, 2) =', math.round(2.567, 2));
console.log('math.floor(2.9) =', math.floor(2.9));
console.log('math.ceil(2.1) =', math.ceil(2.1));

// Constants
console.log('\n--- Constants ---');
console.log('math.pi =', math.pi);
console.log('math.e =', math.e);
console.log('math.i =', math.i.toString());
console.log('math.phi =', math.phi);
console.log('math.tau =', math.tau);

// Configuration
console.log('\n--- Configuration ---');
const config = math.config();
console.log('Current config:', config);

math.config({ precision: 128 });
console.log('After config({ precision: 128 }):', math.config());

console.log('\n=== Migration Complete! ===');
console.log('\nYour mathjs code works with MathTS.');
console.log('Gradually adopt native API for performance gains.');
