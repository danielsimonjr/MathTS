/**
 * Basic Arithmetic Example
 *
 * Demonstrates basic arithmetic operations with different numeric types.
 *
 * Run: npx tsx examples/basic-arithmetic.ts
 */

import { Complex, Fraction, BigNumber, I } from '@mathts/core';
import { add, subtract, multiply, divide, pow, sqrt } from '@mathts/functions';

console.log('=== MathTS Basic Arithmetic ===\n');

// Numbers
console.log('--- Numbers ---');
console.log('add(1, 2) =', add(1, 2));
console.log('subtract(10, 3) =', subtract(10, 3));
console.log('multiply(4, 5) =', multiply(4, 5));
console.log('divide(15, 3) =', divide(15, 3));
console.log('pow(2, 10) =', pow(2, 10));
console.log('sqrt(16) =', sqrt(16));

// Complex Numbers
console.log('\n--- Complex Numbers ---');
const z1 = new Complex(3, 4);
const z2 = new Complex(1, 2);

console.log('z1 =', z1.toString());
console.log('z2 =', z2.toString());
console.log('z1 + z2 =', add(z1, z2).toString());
console.log('z1 * z2 =', multiply(z1, z2).toString());
console.log('|z1| =', z1.abs());
console.log('arg(z1) =', z1.arg(), 'radians');
console.log('conj(z1) =', z1.conjugate().toString());
console.log('z1^2 =', z1.pow(2).toString());

// Using imaginary unit
console.log('\n--- Imaginary Unit ---');
const z3 = z1.add(I);
console.log('z1 + i =', z3.toString());
console.log('i^2 =', I.pow(2).toString());

// Fractions
console.log('\n--- Fractions ---');
const f1 = new Fraction(1, 3);
const f2 = new Fraction(1, 6);

console.log('f1 =', f1.toString());
console.log('f2 =', f2.toString());
console.log('f1 + f2 =', add(f1, f2).toString());
console.log('f1 * f2 =', multiply(f1, f2).toString());
console.log('f1 / f2 =', divide(f1, f2).toString());
console.log('f1 as decimal =', f1.valueOf());

// BigNumber (no floating point errors)
console.log('\n--- BigNumber (Exact Arithmetic) ---');
const bn1 = BigNumber.parse('0.1');
const bn2 = BigNumber.parse('0.2');

console.log('bn1 =', bn1.toString());
console.log('bn2 =', bn2.toString());
console.log('bn1 + bn2 =', add(bn1, bn2).toString(), '(exact!)');

// Compare with regular floating point
console.log('\nRegular JS: 0.1 + 0.2 =', 0.1 + 0.2, '(floating point error)');

console.log('\n=== Done ===');
