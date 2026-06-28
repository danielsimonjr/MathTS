/**
 * Type definitions for string utility functions
 */

export function endsWith(text: string, search: string): boolean;

export function format(value: unknown, options?: unknown): string;

export function stringify(value: unknown): string;

export function escape(value: unknown): string;

export function compareText(x: unknown, y: unknown): number;
