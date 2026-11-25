import { compatVersion, instanceSymbols } from './instance-symbols.js';

// Direct imports share the constructors and predicates used by configured instances.
const compatAccessorNode: (typeof instanceSymbols)['AccessorNode'] = instanceSymbols.AccessorNode;
const compatArgumentsError: (typeof instanceSymbols)['ArgumentsError'] =
  instanceSymbols.ArgumentsError;
const compatArrayNode: (typeof instanceSymbols)['ArrayNode'] = instanceSymbols.ArrayNode;
const compatAssignmentNode: (typeof instanceSymbols)['AssignmentNode'] =
  instanceSymbols.AssignmentNode;
const compatBlockNode: (typeof instanceSymbols)['BlockNode'] = instanceSymbols.BlockNode;
const compatConditionalNode: (typeof instanceSymbols)['ConditionalNode'] =
  instanceSymbols.ConditionalNode;
const compatConstantNode: (typeof instanceSymbols)['ConstantNode'] = instanceSymbols.ConstantNode;
const compatDimensionError: (typeof instanceSymbols)['DimensionError'] =
  instanceSymbols.DimensionError;
const compatFibonacciHeap: (typeof instanceSymbols)['FibonacciHeap'] =
  instanceSymbols.FibonacciHeap;
const compatFunctionAssignmentNode: (typeof instanceSymbols)['FunctionAssignmentNode'] =
  instanceSymbols.FunctionAssignmentNode;
const compatFunctionNode: (typeof instanceSymbols)['FunctionNode'] = instanceSymbols.FunctionNode;
const compatImmutableDenseMatrix: (typeof instanceSymbols)['ImmutableDenseMatrix'] =
  instanceSymbols.ImmutableDenseMatrix;
const compatIndex: (typeof instanceSymbols)['Index'] = instanceSymbols.Index;
const compatIndexError: (typeof instanceSymbols)['IndexError'] = instanceSymbols.IndexError;
const compatIndexNode: (typeof instanceSymbols)['IndexNode'] = instanceSymbols.IndexNode;
const compatMatrix: (typeof instanceSymbols)['Matrix'] = instanceSymbols.Matrix;
const compatNode: (typeof instanceSymbols)['Node'] = instanceSymbols.Node;
const compatObjectNode: (typeof instanceSymbols)['ObjectNode'] = instanceSymbols.ObjectNode;
const compatOperatorNode: (typeof instanceSymbols)['OperatorNode'] = instanceSymbols.OperatorNode;
const compatParenthesisNode: (typeof instanceSymbols)['ParenthesisNode'] =
  instanceSymbols.ParenthesisNode;
const compatRange: (typeof instanceSymbols)['Range'] = instanceSymbols.Range;
const compatRangeNode: (typeof instanceSymbols)['RangeNode'] = instanceSymbols.RangeNode;
const compatRelationalNode: (typeof instanceSymbols)['RelationalNode'] =
  instanceSymbols.RelationalNode;
const compatResultSet: (typeof instanceSymbols)['ResultSet'] = instanceSymbols.ResultSet;
const compatSpa: (typeof instanceSymbols)['Spa'] = instanceSymbols.Spa;
const compatSymbolNode: (typeof instanceSymbols)['SymbolNode'] = instanceSymbols.SymbolNode;
const compatUnit: (typeof instanceSymbols)['Unit'] = instanceSymbols.Unit;
const compatDen: (typeof instanceSymbols)['den'] = instanceSymbols.den;
const compatFactory: (typeof instanceSymbols)['factory'] = instanceSymbols.factory;
const compatIsAccessorNode: (typeof instanceSymbols)['isAccessorNode'] =
  instanceSymbols.isAccessorNode;
const compatIsArray: (typeof instanceSymbols)['isArray'] = instanceSymbols.isArray;
const compatIsArrayNode: (typeof instanceSymbols)['isArrayNode'] = instanceSymbols.isArrayNode;
const compatIsAssignmentNode: (typeof instanceSymbols)['isAssignmentNode'] =
  instanceSymbols.isAssignmentNode;
const compatIsBigInt: (typeof instanceSymbols)['isBigInt'] = instanceSymbols.isBigInt;
const compatIsBlockNode: (typeof instanceSymbols)['isBlockNode'] = instanceSymbols.isBlockNode;
const compatIsBoolean: (typeof instanceSymbols)['isBoolean'] = instanceSymbols.isBoolean;
const compatIsChain: (typeof instanceSymbols)['isChain'] = instanceSymbols.isChain;
const compatIsCollection: (typeof instanceSymbols)['isCollection'] = instanceSymbols.isCollection;
const compatIsConditionalNode: (typeof instanceSymbols)['isConditionalNode'] =
  instanceSymbols.isConditionalNode;
const compatIsConstantNode: (typeof instanceSymbols)['isConstantNode'] =
  instanceSymbols.isConstantNode;
const compatIsDate: (typeof instanceSymbols)['isDate'] = instanceSymbols.isDate;
const compatIsDenseMatrix: (typeof instanceSymbols)['isDenseMatrix'] =
  instanceSymbols.isDenseMatrix;
const compatIsFunction: (typeof instanceSymbols)['isFunction'] = instanceSymbols.isFunction;
const compatIsFunctionAssignmentNode: (typeof instanceSymbols)['isFunctionAssignmentNode'] =
  instanceSymbols.isFunctionAssignmentNode;
const compatIsFunctionNode: (typeof instanceSymbols)['isFunctionNode'] =
  instanceSymbols.isFunctionNode;
const compatIsHelp: (typeof instanceSymbols)['isHelp'] = instanceSymbols.isHelp;
const compatIsIndex: (typeof instanceSymbols)['isIndex'] = instanceSymbols.isIndex;
const compatIsIndexNode: (typeof instanceSymbols)['isIndexNode'] = instanceSymbols.isIndexNode;
const compatIsMap: (typeof instanceSymbols)['isMap'] = instanceSymbols.isMap;
const compatIsNode: (typeof instanceSymbols)['isNode'] = instanceSymbols.isNode;
const compatIsNull: (typeof instanceSymbols)['isNull'] = instanceSymbols.isNull;
const compatIsObject: (typeof instanceSymbols)['isObject'] = instanceSymbols.isObject;
const compatIsObjectNode: (typeof instanceSymbols)['isObjectNode'] = instanceSymbols.isObjectNode;
const compatIsObjectWrappingMap: (typeof instanceSymbols)['isObjectWrappingMap'] =
  instanceSymbols.isObjectWrappingMap;
const compatIsOperatorNode: (typeof instanceSymbols)['isOperatorNode'] =
  instanceSymbols.isOperatorNode;
const compatIsParenthesisNode: (typeof instanceSymbols)['isParenthesisNode'] =
  instanceSymbols.isParenthesisNode;
const compatIsPartitionedMap: (typeof instanceSymbols)['isPartitionedMap'] =
  instanceSymbols.isPartitionedMap;
const compatIsRange: (typeof instanceSymbols)['isRange'] = instanceSymbols.isRange;
const compatIsRangeNode: (typeof instanceSymbols)['isRangeNode'] = instanceSymbols.isRangeNode;
const compatIsRegExp: (typeof instanceSymbols)['isRegExp'] = instanceSymbols.isRegExp;
const compatIsRelationalNode: (typeof instanceSymbols)['isRelationalNode'] =
  instanceSymbols.isRelationalNode;
const compatIsResultSet: (typeof instanceSymbols)['isResultSet'] = instanceSymbols.isResultSet;
const compatIsSparseMatrix: (typeof instanceSymbols)['isSparseMatrix'] =
  instanceSymbols.isSparseMatrix;
const compatIsString: (typeof instanceSymbols)['isString'] = instanceSymbols.isString;
const compatIsSymbolNode: (typeof instanceSymbols)['isSymbolNode'] = instanceSymbols.isSymbolNode;
const compatIsUndefined: (typeof instanceSymbols)['isUndefined'] = instanceSymbols.isUndefined;
const compatIsUnit: (typeof instanceSymbols)['isUnit'] = instanceSymbols.isUnit;
const compatNum: (typeof instanceSymbols)['num'] = instanceSymbols.num;
const compatVersionExport: (typeof instanceSymbols)['version'] = instanceSymbols.version;

export {
  compatAccessorNode as AccessorNode,
  compatArgumentsError as ArgumentsError,
  compatArrayNode as ArrayNode,
  compatAssignmentNode as AssignmentNode,
  compatBlockNode as BlockNode,
  compatConditionalNode as ConditionalNode,
  compatConstantNode as ConstantNode,
  compatDimensionError as DimensionError,
  compatFibonacciHeap as FibonacciHeap,
  compatFunctionAssignmentNode as FunctionAssignmentNode,
  compatFunctionNode as FunctionNode,
  compatImmutableDenseMatrix as ImmutableDenseMatrix,
  compatIndex as Index,
  compatIndexError as IndexError,
  compatIndexNode as IndexNode,
  compatMatrix as Matrix,
  compatNode as Node,
  compatObjectNode as ObjectNode,
  compatOperatorNode as OperatorNode,
  compatParenthesisNode as ParenthesisNode,
  compatRange as Range,
  compatRangeNode as RangeNode,
  compatRelationalNode as RelationalNode,
  compatResultSet as ResultSet,
  compatSpa as Spa,
  compatSymbolNode as SymbolNode,
  compatUnit as Unit,
  compatDen as den,
  compatFactory as factory,
  compatIsAccessorNode as isAccessorNode,
  compatIsArray as isArray,
  compatIsArrayNode as isArrayNode,
  compatIsAssignmentNode as isAssignmentNode,
  compatIsBigInt as isBigInt,
  compatIsBlockNode as isBlockNode,
  compatIsBoolean as isBoolean,
  compatIsChain as isChain,
  compatIsCollection as isCollection,
  compatIsConditionalNode as isConditionalNode,
  compatIsConstantNode as isConstantNode,
  compatIsDate as isDate,
  compatIsDenseMatrix as isDenseMatrix,
  compatIsFunction as isFunction,
  compatIsFunctionAssignmentNode as isFunctionAssignmentNode,
  compatIsFunctionNode as isFunctionNode,
  compatIsHelp as isHelp,
  compatIsIndex as isIndex,
  compatIsIndexNode as isIndexNode,
  compatIsMap as isMap,
  compatIsNode as isNode,
  compatIsNull as isNull,
  compatIsObject as isObject,
  compatIsObjectNode as isObjectNode,
  compatIsObjectWrappingMap as isObjectWrappingMap,
  compatIsOperatorNode as isOperatorNode,
  compatIsParenthesisNode as isParenthesisNode,
  compatIsPartitionedMap as isPartitionedMap,
  compatIsRange as isRange,
  compatIsRangeNode as isRangeNode,
  compatIsRegExp as isRegExp,
  compatIsRelationalNode as isRelationalNode,
  compatIsResultSet as isResultSet,
  compatIsSparseMatrix as isSparseMatrix,
  compatIsString as isString,
  compatIsSymbolNode as isSymbolNode,
  compatIsUndefined as isUndefined,
  compatIsUnit as isUnit,
  compatNum as num,
  compatVersionExport as version,
  compatVersion,
};
