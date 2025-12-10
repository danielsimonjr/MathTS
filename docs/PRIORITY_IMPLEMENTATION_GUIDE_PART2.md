# MathTS Priority Implementation Guide - Part 2

## Continuation: Pattern Builder DSL & Advanced Components

### Pattern Builder DSL (continued)

```typescript
// src/symbolic/pattern/builder.ts (continued)

// Constrained pattern variables
export const _number = (name: string) => _(name, e => e instanceof NumberLiteral);
export const _symbol = (name: string) => _(name, e => e instanceof SymbolNode);
export const _positive = (name: string) => _(name, e => 
  e instanceof NumberLiteral && e.evaluate({}) > 0
);
export const _integer = (name: string) => _(name, e => 
  e instanceof NumberLiteral && e.isInteger()
);
export const _nonzero = (name: string) => _(name, e => 
  !(e instanceof NumberLiteral && e.isZero())
);

// Literal patterns
export function lit(value: number | Expression): LiteralPattern {
  if (typeof value === 'number') {
    return new LiteralPattern(new NumberLiteral(value));
  }
  return new LiteralPattern(value);
}

// Structural patterns
export function add(...terms: (Pattern | Expression)[]): AddPattern {
  return new AddPattern(terms.map(toPattern));
}

export function mul(...factors: (Pattern | Expression)[]): MultiplyPattern {
  return new MultiplyPattern(factors.map(toPattern));
}

export function pow(base: Pattern | Expression, exp: Pattern | Expression): PowerPattern {
  return new PowerPattern(toPattern(base), toPattern(exp));
}

export function fn(name: string, ...args: (Pattern | Expression)[]): FunctionPattern {
  return new FunctionPattern(name, args.map(toPattern));
}

// Convert expression to pattern
function toPattern(p: Pattern | Expression): Pattern {
  if (p instanceof Pattern) return p;
  return new LiteralPattern(p);
}
```

---

## Curvature Tensors Implementation

```typescript
// src/tensor/curvature.ts

/**
 * Curvature tensor computations from a metric
 */
export class CurvatureTensors {
  private metric: MetricTensor;
  private christoffel: Tensor;
  private simplifier: SimplificationEngine;
  
  private _riemann?: Tensor;
  private _ricci?: Tensor;
  private _ricciScalar?: Expression;
  private _einstein?: Tensor;
  private _weyl?: Tensor;
  
  constructor(metric: MetricTensor) {
    this.metric = metric;
    this.christoffel = metric.christoffelSecond();
    this.simplifier = SimplificationEngine.full();
  }
  
  /**
   * Riemann curvature tensor
   * R^ρ_{σμν} = ∂_μ Γ^ρ_{νσ} - ∂_ν Γ^ρ_{μσ} + Γ^ρ_{μλ}Γ^λ_{νσ} - Γ^ρ_{νλ}Γ^λ_{μσ}
   */
  riemann(): Tensor {
    if (this._riemann) return this._riemann;
    
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const Gamma = this.christoffel;
    const components = NDArray.create<Expression>([n, n, n, n], ZERO);
    
    for (let rho = 0; rho < n; rho++) {
      for (let sigma = 0; sigma < n; sigma++) {
        for (let mu = 0; mu < n; mu++) {
          for (let nu = 0; nu < n; nu++) {
            // ∂_μ Γ^ρ_{νσ}
            const term1 = differentiate(
              Gamma.at(rho, nu, sigma),
              coords[mu]
            );
            
            // -∂_ν Γ^ρ_{μσ}
            const term2 = MultiplyNode.create(
              NEG_ONE,
              differentiate(Gamma.at(rho, mu, sigma), coords[nu])
            );
            
            // Γ^ρ_{μλ}Γ^λ_{νσ} - Γ^ρ_{νλ}Γ^λ_{μσ}
            let term3: Expression = ZERO;
            let term4: Expression = ZERO;
            
            for (let lambda = 0; lambda < n; lambda++) {
              term3 = AddNode.create(
                term3,
                MultiplyNode.create(
                  Gamma.at(rho, mu, lambda),
                  Gamma.at(lambda, nu, sigma)
                )
              );
              
              term4 = AddNode.create(
                term4,
                MultiplyNode.create(
                  Gamma.at(rho, nu, lambda),
                  Gamma.at(lambda, mu, sigma)
                )
              );
            }
            
            const result = AddNode.create(
              term1, term2, term3,
              MultiplyNode.create(NEG_ONE, term4)
            );
            
            components.set(
              [rho, sigma, mu, nu],
              this.simplifier.simplify(result)
            );
          }
        }
      }
    }
    
    this._riemann = new Tensor(components, '^ρ_σμν');
    return this._riemann;
  }
  
  /**
   * Ricci tensor
   * R_{μν} = R^ρ_{μρν}
   */
  ricci(): Tensor {
    if (this._ricci) return this._ricci;
    
    const n = this.metric.dimension;
    const R = this.riemann();
    const components = NDArray.create<Expression>([n, n], ZERO);
    
    for (let mu = 0; mu < n; mu++) {
      for (let nu = 0; nu < n; nu++) {
        // Contract: R^ρ_{μρν}
        let sum: Expression = ZERO;
        for (let rho = 0; rho < n; rho++) {
          sum = AddNode.create(sum, R.at(rho, mu, rho, nu));
        }
        components.set([mu, nu], this.simplifier.simplify(sum));
      }
    }
    
    this._ricci = new Tensor(components, 'μν');
    return this._ricci;
  }
  
  /**
   * Ricci scalar
   * R = g^{μν} R_{μν}
   */
  ricciScalar(): Expression {
    if (this._ricciScalar) return this._ricciScalar;
    
    const n = this.metric.dimension;
    const gInv = this.metric.inverse();
    const Ric = this.ricci();
    
    let sum: Expression = ZERO;
    for (let mu = 0; mu < n; mu++) {
      for (let nu = 0; nu < n; nu++) {
        sum = AddNode.create(
          sum,
          MultiplyNode.create(gInv.at(mu, nu), Ric.at(mu, nu))
        );
      }
    }
    
    this._ricciScalar = this.simplifier.simplify(sum);
    return this._ricciScalar;
  }
  
  /**
   * Einstein tensor
   * G_{μν} = R_{μν} - (1/2) g_{μν} R
   */
  einstein(): Tensor {
    if (this._einstein) return this._einstein;
    
    const n = this.metric.dimension;
    const Ric = this.ricci();
    const R = this.ricciScalar();
    const g = this.metric;
    const components = NDArray.create<Expression>([n, n], ZERO);
    
    for (let mu = 0; mu < n; mu++) {
      for (let nu = 0; nu < n; nu++) {
        // G_{μν} = R_{μν} - (1/2) g_{μν} R
        const result = AddNode.create(
          Ric.at(mu, nu),
          MultiplyNode.create(
            new NumberLiteral(new Fraction(-1, 2), true),
            g.at(mu, nu),
            R
          )
        );
        components.set([mu, nu], this.simplifier.simplify(result));
      }
    }
    
    this._einstein = new Tensor(components, 'μν');
    return this._einstein;
  }
  
  /**
   * Weyl (conformal) tensor
   * For n=4:
   * C_{ρσμν} = R_{ρσμν} - (1/(n-2))(g_{ρμ}R_{σν} - g_{ρν}R_{σμ} - g_{σμ}R_{ρν} + g_{σν}R_{ρμ})
   *            + (R/((n-1)(n-2)))(g_{ρμ}g_{σν} - g_{ρν}g_{σμ})
   */
  weyl(): Tensor {
    if (this._weyl) return this._weyl;
    
    const n = this.metric.dimension;
    if (n < 3) {
      throw new Error('Weyl tensor requires dimension ≥ 3');
    }
    
    const R_tensor = this.riemannDown(); // R_{ρσμν}
    const Ric = this.ricci();
    const R = this.ricciScalar();
    const g = this.metric;
    
    const factor1 = new NumberLiteral(new Fraction(1, n - 2), true);
    const factor2 = new NumberLiteral(new Fraction(1, (n - 1) * (n - 2)), true);
    
    const components = NDArray.create<Expression>([n, n, n, n], ZERO);
    
    for (let rho = 0; rho < n; rho++) {
      for (let sigma = 0; sigma < n; sigma++) {
        for (let mu = 0; mu < n; mu++) {
          for (let nu = 0; nu < n; nu++) {
            // First term: R_{ρσμν}
            let result = R_tensor.at(rho, sigma, mu, nu);
            
            // Second term (Ricci contributions)
            const ricci_term = AddNode.create(
              MultiplyNode.create(g.at(rho, mu), Ric.at(sigma, nu)),
              MultiplyNode.create(NEG_ONE, g.at(rho, nu), Ric.at(sigma, mu)),
              MultiplyNode.create(NEG_ONE, g.at(sigma, mu), Ric.at(rho, nu)),
              MultiplyNode.create(g.at(sigma, nu), Ric.at(rho, mu))
            );
            
            result = AddNode.create(
              result,
              MultiplyNode.create(NEG_ONE, factor1, ricci_term)
            );
            
            // Third term (scalar curvature contribution)
            const metric_term = AddNode.create(
              MultiplyNode.create(g.at(rho, mu), g.at(sigma, nu)),
              MultiplyNode.create(NEG_ONE, g.at(rho, nu), g.at(sigma, mu))
            );
            
            result = AddNode.create(
              result,
              MultiplyNode.create(factor2, R, metric_term)
            );
            
            components.set(
              [rho, sigma, mu, nu],
              this.simplifier.simplify(result)
            );
          }
        }
      }
    }
    
    this._weyl = new Tensor(components, 'ρσμν');
    return this._weyl;
  }
  
  /**
   * Kretschmann scalar
   * K = R^{αβγδ} R_{αβγδ}
   */
  kretschmann(): Expression {
    const n = this.metric.dimension;
    const R_up = this.riemann();      // R^ρ_{σμν}
    const R_down = this.riemannDown(); // R_{ρσμν}
    const gInv = this.metric.inverse();
    
    let sum: Expression = ZERO;
    
    // K = g^{ρα} g^{σβ} g^{μγ} g^{νδ} R_{ρσμν} R_{αβγδ}
    // This is computationally expensive!
    for (let rho = 0; rho < n; rho++) {
      for (let sigma = 0; sigma < n; sigma++) {
        for (let mu = 0; mu < n; mu++) {
          for (let nu = 0; nu < n; nu++) {
            for (let alpha = 0; alpha < n; alpha++) {
              for (let beta = 0; beta < n; beta++) {
                for (let gamma = 0; gamma < n; gamma++) {
                  for (let delta = 0; delta < n; delta++) {
                    const term = MultiplyNode.create(
                      gInv.at(rho, alpha),
                      gInv.at(sigma, beta),
                      gInv.at(mu, gamma),
                      gInv.at(nu, delta),
                      R_down.at(rho, sigma, mu, nu),
                      R_down.at(alpha, beta, gamma, delta)
                    );
                    sum = AddNode.create(sum, term);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return this.simplifier.simplify(sum);
  }
  
  /**
   * Riemann tensor with all indices down
   * R_{ρσμν} = g_{ρλ} R^λ_{σμν}
   */
  private riemannDown(): Tensor {
    const n = this.metric.dimension;
    const R_up = this.riemann();
    const g = this.metric;
    const components = NDArray.create<Expression>([n, n, n, n], ZERO);
    
    for (let rho = 0; rho < n; rho++) {
      for (let sigma = 0; sigma < n; sigma++) {
        for (let mu = 0; mu < n; mu++) {
          for (let nu = 0; nu < n; nu++) {
            let sum: Expression = ZERO;
            for (let lambda = 0; lambda < n; lambda++) {
              sum = AddNode.create(
                sum,
                MultiplyNode.create(
                  g.at(rho, lambda),
                  R_up.at(lambda, sigma, mu, nu)
                )
              );
            }
            components.set(
              [rho, sigma, mu, nu],
              this.simplifier.simplify(sum)
            );
          }
        }
      }
    }
    
    return new Tensor(components, 'ρσμν');
  }
}
```

---

## Covariant Derivative Implementation

```typescript
// src/tensor/covariant.ts

/**
 * Covariant derivative operations
 */
export class CovariantDerivative {
  private metric: MetricTensor;
  private christoffel: Tensor;
  private simplifier: SimplificationEngine;
  
  constructor(metric: MetricTensor) {
    this.metric = metric;
    this.christoffel = metric.christoffelSecond();
    this.simplifier = SimplificationEngine.algebraic();
  }
  
  /**
   * Covariant derivative of a scalar field
   * ∇_μ φ = ∂_μ φ
   */
  ofScalar(scalar: Expression, indexName: string = 'μ'): Tensor {
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const components: Expression[] = [];
    
    for (let mu = 0; mu < n; mu++) {
      components.push(differentiate(scalar, coords[mu]));
    }
    
    return new Tensor(
      NDArray.from1D(components),
      [{ name: indexName, position: 'down' }]
    );
  }
  
  /**
   * Covariant derivative of a contravariant vector
   * ∇_μ V^ν = ∂_μ V^ν + Γ^ν_{μρ} V^ρ
   */
  ofContravariantVector(vector: Tensor, indexName: string = 'μ'): Tensor {
    this.validateRank(vector, [1, 0]);
    
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const Gamma = this.christoffel;
    const components = NDArray.create<Expression>([n, n], ZERO);
    
    for (let mu = 0; mu < n; mu++) {
      for (let nu = 0; nu < n; nu++) {
        // ∂_μ V^ν
        let result = differentiate(vector.at(nu), coords[mu]);
        
        // + Γ^ν_{μρ} V^ρ
        for (let rho = 0; rho < n; rho++) {
          result = AddNode.create(
            result,
            MultiplyNode.create(Gamma.at(nu, mu, rho), vector.at(rho))
          );
        }
        
        components.set([mu, nu], this.simplifier.simplify(result));
      }
    }
    
    // Index structure: ∇_μ V^ν has indices (down, up)
    return new Tensor(components, `_${indexName}^${vector.indices[0].name}`);
  }
  
  /**
   * Covariant derivative of a covariant vector
   * ∇_μ V_ν = ∂_μ V_ν - Γ^ρ_{μν} V_ρ
   */
  ofCovariantVector(vector: Tensor, indexName: string = 'μ'): Tensor {
    this.validateRank(vector, [0, 1]);
    
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const Gamma = this.christoffel;
    const components = NDArray.create<Expression>([n, n], ZERO);
    
    for (let mu = 0; mu < n; mu++) {
      for (let nu = 0; nu < n; nu++) {
        // ∂_μ V_ν
        let result = differentiate(vector.at(nu), coords[mu]);
        
        // - Γ^ρ_{μν} V_ρ
        for (let rho = 0; rho < n; rho++) {
          result = AddNode.create(
            result,
            MultiplyNode.create(
              NEG_ONE,
              Gamma.at(rho, mu, nu),
              vector.at(rho)
            )
          );
        }
        
        components.set([mu, nu], this.simplifier.simplify(result));
      }
    }
    
    return new Tensor(components, `_${indexName}_${vector.indices[0].name}`);
  }
  
  /**
   * Covariant derivative of a general tensor
   * Adds Γ term for each contravariant index
   * Subtracts Γ term for each covariant index
   */
  of(tensor: Tensor, indexName: string = 'μ'): Tensor {
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const Gamma = this.christoffel;
    const totalRank = tensor.totalRank;
    
    // New shape: add one dimension for derivative index
    const newShape = [n, ...Array(totalRank).fill(n)];
    const components = NDArray.create<Expression>(newShape, ZERO);
    
    // Iterate over all index combinations
    const tensorIterator = new MultiIndexIterator(Array(totalRank).fill(n));
    
    for (let mu = 0; mu < n; mu++) {
      for (const tensorIdx of tensorIterator) {
        // Start with partial derivative
        let result = differentiate(tensor.at(...tensorIdx), coords[mu]);
        
        // Add/subtract Christoffel terms for each index
        for (let i = 0; i < totalRank; i++) {
          const idx = tensor.indices[i];
          
          if (idx.position === 'up') {
            // Contravariant: + Γ^{idx}_{μρ} T^{...ρ...}
            for (let rho = 0; rho < n; rho++) {
              const newTensorIdx = [...tensorIdx];
              newTensorIdx[i] = rho;
              
              result = AddNode.create(
                result,
                MultiplyNode.create(
                  Gamma.at(tensorIdx[i], mu, rho),
                  tensor.at(...newTensorIdx)
                )
              );
            }
          } else {
            // Covariant: - Γ^ρ_{μ idx} T_{...ρ...}
            for (let rho = 0; rho < n; rho++) {
              const newTensorIdx = [...tensorIdx];
              newTensorIdx[i] = rho;
              
              result = AddNode.create(
                result,
                MultiplyNode.create(
                  NEG_ONE,
                  Gamma.at(rho, mu, tensorIdx[i]),
                  tensor.at(...newTensorIdx)
                )
              );
            }
          }
        }
        
        components.set([mu, ...tensorIdx], this.simplifier.simplify(result));
      }
    }
    
    // Build new index structure
    const newIndices: TensorIndex[] = [
      { name: indexName, position: 'down' },
      ...tensor.indices
    ];
    
    return new Tensor(components, newIndices);
  }
  
  /**
   * Lie derivative along a vector field
   * L_X T = X^μ ∇_μ T + (correction terms based on tensor type)
   */
  lie(tensor: Tensor, vectorField: Tensor): Tensor {
    this.validateRank(vectorField, [1, 0]);
    
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const [upRank, downRank] = tensor.rank;
    const totalRank = tensor.totalRank;
    
    const newShape = Array(totalRank).fill(n);
    const components = NDArray.create<Expression>(newShape, ZERO);
    
    const iterator = new MultiIndexIterator(newShape);
    
    for (const idx of iterator) {
      // First term: X^μ ∂_μ T
      let result: Expression = ZERO;
      for (let mu = 0; mu < n; mu++) {
        result = AddNode.create(
          result,
          MultiplyNode.create(
            vectorField.at(mu),
            differentiate(tensor.at(...idx), coords[mu])
          )
        );
      }
      
      // Correction terms for each index
      for (let i = 0; i < totalRank; i++) {
        const tensorIdx = tensor.indices[i];
        
        if (tensorIdx.position === 'up') {
          // Contravariant: - (∂_ρ X^{idx}) T^{...ρ...}
          for (let rho = 0; rho < n; rho++) {
            const newIdx = [...idx];
            newIdx[i] = rho;
            
            result = AddNode.create(
              result,
              MultiplyNode.create(
                NEG_ONE,
                differentiate(vectorField.at(idx[i]), coords[rho]),
                tensor.at(...newIdx)
              )
            );
          }
        } else {
          // Covariant: + (∂_{idx} X^ρ) T_{...ρ...}
          for (let rho = 0; rho < n; rho++) {
            const newIdx = [...idx];
            newIdx[i] = rho;
            
            result = AddNode.create(
              result,
              MultiplyNode.create(
                differentiate(vectorField.at(rho), coords[idx[i]]),
                tensor.at(...newIdx)
              )
            );
          }
        }
      }
      
      components.set(idx, this.simplifier.simplify(result));
    }
    
    return new Tensor(components, tensor.indices);
  }
  
  private validateRank(tensor: Tensor, expected: [number, number]): void {
    const [up, down] = tensor.rank;
    if (up !== expected[0] || down !== expected[1]) {
      throw new Error(
        `Expected tensor of rank (${expected[0]},${expected[1]}), got (${up},${down})`
      );
    }
  }
}
```

---

## Geodesic Equation Solver

```typescript
// src/tensor/geodesic.ts

/**
 * Geodesic computation and solving
 */
export class GeodesicSolver {
  private metric: MetricTensor;
  private christoffel: Tensor;
  
  constructor(metric: MetricTensor) {
    this.metric = metric;
    this.christoffel = metric.christoffelSecond();
  }
  
  /**
   * Generate the geodesic equation symbolically
   * d²x^μ/dτ² + Γ^μ_{αβ} (dx^α/dτ)(dx^β/dτ) = 0
   */
  geodesicEquation(): DifferentialEquation[] {
    const n = this.metric.dimension;
    const coords = this.metric.coordinates;
    const Gamma = this.christoffel;
    const tau = symbol('τ');
    
    const equations: DifferentialEquation[] = [];
    
    for (let mu = 0; mu < n; mu++) {
      const x_mu = coords[mu];
      
      // d²x^μ/dτ²
      const acceleration = new DerivativeNode(
        new DerivativeNode(x_mu, tau),
        tau
      );
      
      // Γ^μ_{αβ} (dx^α/dτ)(dx^β/dτ)
      let christoffelTerm: Expression = ZERO;
      
      for (let alpha = 0; alpha < n; alpha++) {
        for (let beta = 0; beta < n; beta++) {
          const velocity_alpha = new DerivativeNode(coords[alpha], tau);
          const velocity_beta = new DerivativeNode(coords[beta], tau);
          
          christoffelTerm = AddNode.create(
            christoffelTerm,
            MultiplyNode.create(
              Gamma.at(mu, alpha, beta),
              velocity_alpha,
              velocity_beta
            )
          );
        }
      }
      
      // Full equation: d²x^μ/dτ² + Christoffel term = 0
      equations.push({
        lhs: AddNode.create(acceleration, christoffelTerm),
        rhs: ZERO,
        type: 'second-order-ode'
      });
    }
    
    return equations;
  }
  
  /**
   * Solve geodesic numerically
   */
  solveNumeric(
    initialPosition: number[],
    initialVelocity: number[],
    tauRange: [number, number],
    options?: GeodesicOptions
  ): GeodesicSolution {
    const n = this.metric.dimension;
    const steps = options?.steps ?? 1000;
    const dtau = (tauRange[1] - tauRange[0]) / steps;
    
    // State vector: [x^0, x^1, ..., x^{n-1}, v^0, v^1, ..., v^{n-1}]
    let state = [...initialPosition, ...initialVelocity];
    
    const trajectory: number[][] = [initialPosition.slice()];
    const velocities: number[][] = [initialVelocity.slice()];
    const properTimes: number[] = [tauRange[0]];
    
    // RK4 integration
    for (let i = 0; i < steps; i++) {
      const tau = tauRange[0] + i * dtau;
      state = this.rk4Step(state, tau, dtau);
      
      const position = state.slice(0, n);
      const velocity = state.slice(n);
      
      trajectory.push(position.slice());
      velocities.push(velocity.slice());
      properTimes.push(tau + dtau);
    }
    
    return {
      trajectory,
      velocities,
      properTimes,
      metric: this.metric
    };
  }
  
  /**
   * RK4 integration step for geodesic equation
   */
  private rk4Step(state: number[], tau: number, dtau: number): number[] {
    const k1 = this.geodesicDerivative(state, tau);
    const k2 = this.geodesicDerivative(
      this.addVectors(state, this.scaleVector(k1, dtau / 2)),
      tau + dtau / 2
    );
    const k3 = this.geodesicDerivative(
      this.addVectors(state, this.scaleVector(k2, dtau / 2)),
      tau + dtau / 2
    );
    const k4 = this.geodesicDerivative(
      this.addVectors(state, this.scaleVector(k3, dtau)),
      tau + dtau
    );
    
    // state + (dtau/6)(k1 + 2*k2 + 2*k3 + k4)
    const update = this.scaleVector(
      this.addVectors(
        k1,
        this.scaleVector(k2, 2),
        this.scaleVector(k3, 2),
        k4
      ),
      dtau / 6
    );
    
    return this.addVectors(state, update);
  }
  
  /**
   * Compute derivative of state for geodesic equation
   * dx^μ/dτ = v^μ
   * dv^μ/dτ = -Γ^μ_{αβ} v^α v^β
   */
  private geodesicDerivative(state: number[], _tau: number): number[] {
    const n = this.metric.dimension;
    const x = state.slice(0, n);
    const v = state.slice(n);
    
    // Create scope for evaluating Christoffel symbols
    const scope: Scope = {};
    for (let i = 0; i < n; i++) {
      scope[this.metric.coordinates[i].name] = x[i];
    }
    
    const dx = [...v]; // dx^μ/dτ = v^μ
    const dv: number[] = [];
    
    for (let mu = 0; mu < n; mu++) {
      let acceleration = 0;
      
      for (let alpha = 0; alpha < n; alpha++) {
        for (let beta = 0; beta < n; beta++) {
          const gamma = this.christoffel.at(mu, alpha, beta).evaluate(scope);
          if (typeof gamma === 'number') {
            acceleration -= gamma * v[alpha] * v[beta];
          }
        }
      }
      
      dv.push(acceleration);
    }
    
    return [...dx, ...dv];
  }
  
  private addVectors(...vectors: number[][]): number[] {
    const result = new Array(vectors[0].length).fill(0);
    for (const v of vectors) {
      for (let i = 0; i < v.length; i++) {
        result[i] += v[i];
      }
    }
    return result;
  }
  
  private scaleVector(v: number[], s: number): number[] {
    return v.map(x => x * s);
  }
}

interface GeodesicOptions {
  steps?: number;
  method?: 'rk4' | 'rk45' | 'symplectic';
  eventDetection?: (state: number[], tau: number) => boolean;
}

interface GeodesicSolution {
  trajectory: number[][];
  velocities: number[][];
  properTimes: number[];
  metric: MetricTensor;
}
```

---

## Summary: Files to Create

The complete MathTS enhancement requires creating these primary modules:

### Core Symbolic (`@mathts/symbolic`)
1. `types.ts` - Expression type definitions
2. `nodes/number.ts` - Number literals
3. `nodes/symbol.ts` - Symbolic variables
4. `nodes/add.ts` - Addition (n-ary)
5. `nodes/multiply.ts` - Multiplication (n-ary)
6. `nodes/power.ts` - Exponentiation
7. `nodes/function.ts` - Function calls
8. `pattern/types.ts` - Pattern matching types
9. `pattern/builder.ts` - Pattern DSL
10. `simplify/rules.ts` - Simplification rules
11. `simplify/engine.ts` - Simplification engine

### Tensor Algebra (`@mathts/tensor`)
1. `index.ts` - Index system
2. `tensor.ts` - Base tensor class
3. `metric.ts` - Metric tensor
4. `curvature.ts` - Curvature tensors
5. `covariant.ts` - Covariant derivatives
6. `geodesic.ts` - Geodesic solver

### Calculus (`@mathts/calculus`)
1. `differentiate.ts` - Symbolic differentiation
2. `integrate.ts` - Symbolic integration
3. `series.ts` - Series expansion
4. `limit.ts` - Limit computation
5. `vector.ts` - Vector calculus

### Special Functions (`@mathts/special`)
1. `bessel.ts` - Bessel functions
2. `orthogonal.ts` - Orthogonal polynomials
3. `elliptic.ts` - Elliptic functions
4. `hypergeometric.ts` - Hypergeometric functions

This implementation guide provides the foundational code patterns for building MathTS into a Mathematica/Maple-competitive scientific computing platform.
