import Decimal from 'decimal.js';

/**
 * JSON representation of a BigNumber
 */
export interface BigNumberJSON {
  mathjs: 'BigNumber';
  value: string;
}

/**
 * BigNumber class constructor interface
 */
export interface BigNumberClass {
  new (value: Decimal.Value): BigNumberInstance;
  fromJSON(json: BigNumberJSON): BigNumberInstance;
  config(options: Decimal.Config): BigNumberClass;
}

/**
 * BigNumber instance interface with mathjs-specific properties
 * Extends Omit<Decimal, 'toJSON'> to avoid conflict with Decimal's toJSON() signature
 */
export interface BigNumberInstance extends Omit<Decimal, 'toJSON'> {
  type: 'BigNumber';
  isBigNumber: true;
  toJSON(): BigNumberJSON;
}

/** Type alias for convenience */
export type BigNumber = BigNumberInstance;
