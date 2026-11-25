/** Options for `evaluate` / `compileExpr` / `parser` (public surface for generated overloads). */
export interface PhysicsEvaluateOptions {
  unsafe?: boolean;
  safe?: boolean;
  policy?: 'safe' | 'mathjs';
  physics?: boolean;
  charge?: 'unit' | 'scalar';
}
