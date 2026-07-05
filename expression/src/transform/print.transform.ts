import { factory } from '../utils/factory.js';
import { printTemplate } from '../utils/print.js';

interface TypedFunction<T = unknown> {
  (...args: unknown[]): T;
}

interface Dependencies {
  print: (...args: unknown[]) => unknown;
  typed: TypedFunction;
}

const name = 'print';
const dependencies = ['typed', 'print'];

export const createPrintTransform = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, print }: Dependencies) => {
    return typed(name, {
      'string, Object | Array': function (template: string, values: unknown): string {
        return print(_convertTemplateToZeroBasedIndex(template), values) as string;
      },
      'string, Object | Array, number | Object': function (
        template: string,
        values: unknown,
        options: unknown
      ): string {
        return print(_convertTemplateToZeroBasedIndex(template), values, options) as string;
      },
    });

    function _convertTemplateToZeroBasedIndex(template: string): string {
      return template.replace(printTemplate, (x: string) => {
        const parts = x.slice(1).split('.');
        const result = parts.map(function (part) {
          if (!isNaN(Number(part)) && part.length > 0) {
            return parseInt(part) - 1;
          } else {
            return part;
          }
        });
        return '$' + result.join('.');
      });
    }
  },
  { isTransformFunction: true }
);
