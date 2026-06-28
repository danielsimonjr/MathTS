/**
 * Type definitions for customs utility functions
 */

export function getSafeProperty(object: unknown, prop: string): unknown;

export function setSafeProperty(object: unknown, prop: string, value: unknown): unknown;

export function isSafeProperty(object: unknown, prop: string): boolean;

export function getSafeMethod(object: unknown, method: string): unknown;

export function isSafeMethod(object: unknown, method: string): boolean;

export function isPlainObject(object: unknown): boolean;
