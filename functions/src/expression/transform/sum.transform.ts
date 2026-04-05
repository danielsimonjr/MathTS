import { factory } from '../../utils/factory.js'
import { errorTransform } from './utils/errorTransform.js'
import { createSum } from '../../statistics/sum.js'
import { lastDimToZeroBase } from './utils/lastDimToZeroBase.js'
import type {
  TypedFunction,
  MathFunction,
  MathJsConfig,
  VariadicArgs
} from './types.js'

interface SumDependencies {
  typed: TypedFunction
  config: MathJsConfig
  add: MathFunction
  numeric: MathFunction
  parseNumberWithConfig: (value: string) => unknown
}

/**
 * Attach a transform function to math.sum
 * Adds a property transform containing the transform function.
 *
 * This transform changed the last `dim` parameter of function sum
 * from one-based to zero based
 */
const name = 'sum'
const dependencies = ['typed', 'config', 'add', 'numeric', 'parseNumberWithConfig']

export const createSumTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, add, numeric, parseNumberWithConfig }: SumDependencies) => {
    const sum = createSum({ typed, config, add, numeric, parseNumberWithConfig })

    return typed(name, {
      '...any': function (args: VariadicArgs): unknown {
        args = lastDimToZeroBase(args)

        try {
          return sum.apply(null, args)
        } catch (err) {
          throw errorTransform(err as Error)
        }
      }
    })
  },
  { isTransformFunction: true }
)
