/** Options for `evaluate` / `compileExpr` / `parser` (public surface for generated overloads). */
export interface PhysicsEvaluateOptions {
  unsafe?: boolean;
  physics?: boolean;
  charge?: 'unit' | 'scalar';
}
