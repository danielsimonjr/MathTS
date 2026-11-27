/** Expression functions compiled in-parser carry `syntax` and `expr` for JSON (#1782). */
type ExpressionFunction = ((...args: unknown[]) => unknown) & {
  syntax?: string;
  expr?: string;
};

/** True when `value` is a parser-defined function with mathjs `syntax` / `expr` metadata. */
export function isExpressionFunction(value: unknown): value is ExpressionFunction {
  const fn = value as Partial<ExpressionFunction>;
  return (
    typeof value === 'function' && typeof fn.syntax === 'string' && typeof fn.expr === 'string'
  );
}

/** After `evaluate('f(x) = rhs')`, typed-function may omit `expr`; mathjs keeps it for JSON. */
export function patchParserFunctionExpr(
  scope: Record<string, unknown>,
  evaluateExpr: string
): void {
  const trimmed = evaluateExpr.trim();
  const match = /^([A-Za-z_]\w*)\(([^)]*)\)\s*=\s*(.+)$/s.exec(trimmed);
  if (!match) return;
  const name = match[1];
  const rhs = match[3]?.trim();
  if (!rhs) return;
  const fn = scope[name];
  if (typeof fn !== 'function') return;
  const typedFn = fn as ExpressionFunction;
  if (typeof typedFn.syntax === 'string' && typedFn.expr === undefined) {
    typedFn.expr = rhs;
  }
}

/** Tagged JSON payload for a mathjs {@link Parser} scope (#1782). */
export type ParserJsonShape = {
  mathjs: 'Parser';
  variables: Record<string, unknown>;
  functions: Record<string, string>;
};

/** Serialize a parser scope to mathjs 15.3.0 JSON (`mathjs: 'Parser'`). */
export function parserToJSON(scope: Record<string, unknown>): ParserJsonShape {
  const json: ParserJsonShape = {
    mathjs: 'Parser',
    variables: {},
    functions: {},
  };

  for (const [name, value] of Object.entries(scope)) {
    if (typeof value === 'function') {
      if (!isExpressionFunction(value)) {
        throw new Error(`Cannot serialize external function ${name}`);
      }
      json.functions[name] = `${value.syntax} = ${value.expr}`;
    } else {
      json.variables[name] = value;
    }
  }

  return json;
}

type ParserLike = {
  scope: Record<string, unknown>;
  evaluate(expr: string): unknown;
};

/** Install `toJSON` / `fromJSON` on a compat `Parser` constructor (#1782). */
export function attachParserJsonMethods<Options>(
  ParserClass: new (options?: Options) => ParserLike,
  createParser: (options?: Options) => ParserLike
): void {
  const proto = ParserClass.prototype as {
    toJSON?: () => ParserJsonShape;
    scope: Record<string, unknown>;
  };
  proto.toJSON = function toJSON(this: { scope: Record<string, unknown> }): ParserJsonShape {
    return parserToJSON(this.scope);
  };

  const ctor = ParserClass as unknown as {
    fromJSON?: (json: ParserJsonShape) => ReturnType<typeof createParser>;
  };
  ctor.fromJSON = function fromJSON(json: ParserJsonShape) {
    const parser = createParser();
    Object.entries(json.variables ?? {}).forEach(([name, value]) => {
      parser.scope[name] = value;
    });
    Object.values(json.functions ?? {}).forEach((fn) => {
      parser.evaluate(fn);
    });
    return parser;
  };
}
