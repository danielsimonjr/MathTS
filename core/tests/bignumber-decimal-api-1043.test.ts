/**
 * #1043: the factory layer of `functions` was ported from mathjs, which uses decimal.js. It calls
 * decimal.js names on core's BigNumber (`gte`, `lt`, `lte`, `eq`, `cmp`, `isInt`, `isNeg`,
 * `minus`, `plus`, `neg`, `dividedBy`, `toDecimalPlaces`, `log`, the statics `atan2` and
 * `precision`). core's BigNumber did not have them, so those paths threw. `pow` read a fractional
 * or BigNumber exponent as an integer and returned a wrong value (`2 ** 0.5` gave 1).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (v: string | number): BigNumber =>
  typeof v === 'number' ? BigNumber.fromNumber(v) : BigNumber.parse(v);

// BigNumber.toPrecision takes any digit count; named constants keep the Number-only lint rule off.
const DIGITS_30 = 30;
const DIGITS_38 = 38;
const DIGITS_70 = 70;
const DIGITS_80 = 80;
const DIGITS_100 = 100;
const SQRT2_50 = '1.4142135623730950488016887242096980785696718753769';

afterEach(() => {
  BigNumber.resetConfig();
});

describe('#1043 decimal.js comparison names', () => {
  it('gte, lt, lte and eq agree with the long names, for BigNumber and number arguments', () => {
    const pairs: [string, string | number][] = [
      ['1', '2'],
      ['2', '2'],
      ['3', '2'],
      ['-1.5', -1.5],
      ['0.1', 0.2],
    ];
    for (const [a, b] of pairs) {
      const x = bn(a);
      const y = typeof b === 'number' ? b : bn(b);
      expect(x.gte(y)).toBe(x.greaterThanOrEqual(y));
      expect(x.lt(y)).toBe(x.lessThan(y));
      expect(x.lte(y)).toBe(x.lessThanOrEqual(y));
      expect(x.eq(y)).toBe(x.equals(y));
    }
  });

  it('cmp gives -1, 0 or 1, and NaN when an operand is NaN (decimal.js)', () => {
    expect(bn('1').cmp(bn('2'))).toBe(-1);
    expect(bn('2').cmp(2)).toBe(0);
    expect(bn('3').cmp(bn('2'))).toBe(1);
    expect(Number.isNaN(bn('NaN').cmp(1))).toBe(true);
    expect(Number.isNaN(bn('1').cmp(bn('NaN')))).toBe(true);
  });
});

describe('#1043 decimal.js predicate and arithmetic names', () => {
  it('isInt, isNeg and isPos', () => {
    expect(bn('4').isInt()).toBe(true);
    expect(bn('4.5').isInt()).toBe(false);
    expect(bn('-3').isNeg()).toBe(true);
    expect(bn('0').isNeg()).toBe(false);
    expect(bn('3').isPos()).toBe(true);
    expect(bn('-3').isPos()).toBe(false);
  });

  it('minus, plus, neg and dividedBy agree with sub, add, negate and div', () => {
    const a = bn('7.25');
    const b = bn('2.5');
    expect(a.minus(b).toString()).toBe(a.sub(b).toString());
    expect(a.plus(b).toString()).toBe(a.add(b).toString());
    expect(a.minus(1).toString()).toBe('6.25');
    expect(a.plus(1).toString()).toBe('8.25');
    expect(a.neg().toString()).toBe('-7.25');
    expect(a.dividedBy(b).toString()).toBe(a.div(b).toString());
  });

  it('toDecimalPlaces rounds half away from zero by default, and takes a decimal.js mode code', () => {
    expect(bn('1.2345').toDecimalPlaces(2).toString()).toBe('1.23');
    expect(bn('2.5').toDecimalPlaces(0).toString()).toBe('3');
    expect(bn('-2.5').toDecimalPlaces(0).toString()).toBe('-3');
    expect(bn('2.5').toDecimalPlaces(0, 6).toString()).toBe('2'); // ROUND_HALF_EVEN
    expect(bn('2.1').toDecimalPlaces(0, 2).toString()).toBe('3'); // ROUND_CEIL
    expect(bn('-2.1').toDecimalPlaces(0, 3).toString()).toBe('-3'); // ROUND_FLOOR
    expect(bn('2.9').toDecimalPlaces(0, 1).toString()).toBe('2'); // ROUND_DOWN
    expect(() => bn('1').toDecimalPlaces(0, 9)).toThrow(RangeError);
  });

  it('log takes a base, default 10 (decimal.js)', () => {
    expect(bn('1000').log().toNumber()).toBeCloseTo(3, 14);
    expect(bn('8').log(2).toNumber()).toBeCloseTo(3, 14);
    expect(bn('81').log(bn('3')).toNumber()).toBeCloseTo(4, 14);
  });
});

describe('#1043 decimal.js statics', () => {
  it('BigNumber.precision reads the configured precision', () => {
    expect(BigNumber.precision).toBe(BigNumber.config().precision);
    BigNumber.config({ precision: 40 });
    expect(BigNumber.precision).toBe(40);
  });

  it('BigNumber.atan2(y, x) agrees with y.atan2(x)', () => {
    const y = bn('1');
    const x = bn('-1');
    expect(BigNumber.atan2(y, x).toString()).toBe(y.atan2(x).toString());
  });
});

describe('#1043 pow with a fractional or BigNumber exponent', () => {
  it('2 ** 0.5 is sqrt(2) to the configured precision', () => {
    BigNumber.config({ precision: 40 });
    const r = bn('2').pow(0.5);
    expect(r.toPrecision(DIGITS_38)).toBe(bn(SQRT2_50).toPrecision(DIGITS_38));
    expect(bn('2').pow(bn('0.5')).toPrecision(DIGITS_38)).toBe(bn(SQRT2_50).toPrecision(DIGITS_38));
  });

  it('an integer exponent keeps the exact path, as a number or a BigNumber', () => {
    expect(bn('3').pow(4).toString()).toBe('81');
    expect(bn('3').pow(bn('4')).toString()).toBe('81');
    expect(bn('2').pow(-2).toString()).toBe('0.25');
    expect(bn('-2').pow(3).toString()).toBe('-8');
  });

  it('a negative base with a non-integer exponent gives NaN', () => {
    expect(bn('-8').pow(0.5).isNaN()).toBe(true);
    expect(bn('-8').pow(bn('0.5')).isNaN()).toBe(true);
  });

  it('0 ** 0.5 is 0 and 0 ** -0.5 is Infinity', () => {
    expect(bn('0').pow(0.5).isZero()).toBe(true);
    expect(bn('0').pow(-0.5).isInfinite()).toBe(true);
  });

  it('a fractional exponent uses the configured precision, not 16 digits', () => {
    BigNumber.config({ precision: 50 });
    const r = bn('10').pow(bn('0.3'));
    // 10 ** 0.3 = 1.99526231496887960135... A double gives 16 correct digits only.
    expect(r.toPrecision(DIGITS_30)).toBe('1.99526231496887960135245539674');
  });
});

// Reference values from mpmath at 120 digits, printed to the precision of the case.
const ACCURACY: [number, string, string, string][] = [
  [64, 'sqrt', '0.05', '0.2236067977499789696409173668731276235440618359611525724270897245'],
  [64, 'sqrt', '3', '1.732050807568877293527446341505872366942805253810380628055806979'],
  [64, 'sqrt', '12345.678', '111.1111065555554621666628377220259888081806464322764202229759287'],
  [
    100,
    'sqrt',
    '0.05',
    '0.2236067977499789696409173668731276235440618359611525724270897245410520925637804899414414408378782275',
  ],
  [
    100,
    'sqrt',
    '3',
    '1.732050807568877293527446341505872366942805253810380628055806979451933016908800037081146186757248576',
  ],
  [
    100,
    'sqrt',
    '12345.678',
    '111.1111065555554621666628377220259888081806464322764202229759287177453376663134325851509302041202993',
  ],
  [
    200,
    'atan',
    '0.5',
    '0.46364760900080611621425623146121440202853705428612026381093308872019786416574170530060028398488789255652985225119083751350581818162501115547153056994410562071933626616488010153250275598792580551685389',
  ],
  [
    300,
    'atan',
    '0.5',
    '0.463647609000806116214256231461214402028537054286120263810933088720197864165741705300600283984887892556529852251190837513505818181625011155471530569944105620719336266164880101532502755987925805516853889167478237286538793918012517199484013955838185115095021633306493872154609732078555557208601463227565',
  ],
  [
    300,
    'ln',
    '25',
    '3.21887582486820074920151866645237527905120270853703544382529578294835797541531552926026775618635922159993260604343112579944801045864935239926723323492741145510435927499436649130698571240468305011454031038720175955477945137638708142553230946244361905589704258564271611944513534457057448092317889635673',
  ],
  [
    300,
    'exp',
    '2.5',
    '12.1824939607034734380701759511679661831827677900631613115603983418381851261433144100602555230062957887416497617044278836181191479123304734532982601581104554107201831373951474464994516547173510687665619306258028652601935364672071924096928033640796069114935506221138362334114138159767905921323408537753',
  ],
  [
    300,
    'sin',
    '3',
    '0.141120008059867222100744802808110279846933264252265584151882641232422009967014471911282172853449863750413672948267327416844457031668857573754033657854911217811785476834820782166764137215566658864689844031538330125152783590765223504441950944889833925545622241603836241829395442591744103664574056654115',
  ],
  [
    300,
    'expm1',
    '0.001',
    '0.00100050016670834166805575399305831156307620058070146022851467446035974825144829841271822600415326094306821887209509934206367869611962384097233090553176831192355619849802365290937767773028386848628740987031722433682729066852434222700765064608033537768353940186437293555741142410760449699215591042386836',
  ],
  [
    300,
    'asin',
    '0.5',
    '0.523598775598298873077107230546583814032861566562517636829157432051302734381034833104672470890352844663691347752213717774515640768258430371954226568021413519575047350450323086850926607437158159155063660738135162610988907688079274705631130527545200318190941427820576724768409054441368898934543374856879',
  ],
  [64, 'ln', '25', '3.218875824868200749201518666452375279051202708537035443825295783'],
  [64, 'log10', '7', '0.8450980400142568307122162585926361934835723963239654065036349537'],
  [64, 'log2', '10', '3.321928094887362347870319429489390175864831393024580612054756396'],
  [64, 'exp', '2.5', '12.18249396070347343807017595116796618318276779006316131156039834'],
  [64, 'sin', '3', '0.1411200080598672221007448028081102798469332642522655841518826412'],
  [64, 'cos', '3', '-0.9899924966004454572715727947312613023936790966155883288140859329'],
  [64, 'tan', '1', '1.557407724654902230506974807458360173087250772381520038383946606'],
  [64, 'atan', '0.5', '0.4636476090008061162142562314612144020285370542861202638109330887'],
  [64, 'asin', '0.5', '0.5235987755982988730771072305465838140328615665625176368291574321'],
  [64, 'acos', '0.5', '1.047197551196597746154214461093167628065723133125035273658314864'],
  [64, 'sinh', '1', '1.175201193643801456882381850595600815155717981334095870229565413'],
  [64, 'cosh', '1', '1.543080634815243778477905620757061682601529112365863704737402215'],
  [64, 'tanh', '1', '0.7615941559557648881194582826047935904127685972579365515968105001'],
  [64, 'asinh', '1', '0.8813735870195430252326093249797923090281603282616354107532956087'],
  [64, 'acosh', '2', '1.316957896924816708625046347307968444026981971467516479768472257'],
  [64, 'atanh', '0.5', '0.5493061443340548456976226184612628523237452789113747258673471668'],
  [64, 'cbrt', '10', '2.154434690031883721759293566519350495259344942192108582489235506'],
  [64, 'expm1', '0.001', '0.001000500166708341668055753993058311563076200580701460228514674460'],
  [64, 'log1p', '0.001', '0.0009995003330835331668093989205350114607550623931665519970196668289'],
  [64, 'sqrt', '2', '1.414213562373095048801688724209698078569671875376948073176679738'],
  [
    100,
    'ln',
    '25',
    '3.218875824868200749201518666452375279051202708537035443825295782948357975415315529260267756186359222',
  ],
  [
    100,
    'log10',
    '7',
    '0.8450980400142568307122162585926361934835723963239654065036349537182534399020791660661115278474885733',
  ],
  [
    100,
    'log2',
    '10',
    '3.321928094887362347870319429489390175864831393024580612054756395815934776608625215850139743359370155',
  ],
  [
    100,
    'exp',
    '2.5',
    '12.18249396070347343807017595116796618318276779006316131156039834183818512614331441006025552300629579',
  ],
  [
    100,
    'sin',
    '3',
    '0.1411200080598672221007448028081102798469332642522655841518826412324220099670144719112821728534498638',
  ],
  [
    100,
    'cos',
    '3',
    '-0.9899924966004454572715727947312613023936790966155883288140859329283291975131332204282944793556926022',
  ],
  [
    100,
    'tan',
    '1',
    '1.557407724654902230506974807458360173087250772381520038383946605698861397151727289555099965202242984',
  ],
  [
    100,
    'atan',
    '0.5',
    '0.4636476090008061162142562314612144020285370542861202638109330887201978641657417053006002839848878926',
  ],
  [
    100,
    'asin',
    '0.5',
    '0.5235987755982988730771072305465838140328615665625176368291574320513027343810348331046724708903528447',
  ],
  [
    100,
    'acos',
    '0.5',
    '1.047197551196597746154214461093167628065723133125035273658314864102605468762069666209344941780705689',
  ],
  [
    100,
    'sinh',
    '1',
    '1.175201193643801456882381850595600815155717981334095870229565413013307567304323895607117452089623392',
  ],
  [
    100,
    'cosh',
    '1',
    '1.543080634815243778477905620757061682601529112365863704737402214710769063049223698964264726435543036',
  ],
  [
    100,
    'tanh',
    '1',
    '0.7615941559557648881194582826047935904127685972579365515968105001219532445766384834589475216736767144',
  ],
  [
    100,
    'asinh',
    '1',
    '0.8813735870195430252326093249797923090281603282616354107532956086533771842220260878337068919102560429',
  ],
  [
    100,
    'acosh',
    '2',
    '1.316957896924816708625046347307968444026981971467516479768472256920460185416443976074219013450101784',
  ],
  [
    100,
    'atanh',
    '0.5',
    '0.5493061443340548456976226184612628523237452789113747258673471668187471466093044834368078774068660444',
  ],
  [
    100,
    'cbrt',
    '10',
    '2.154434690031883721759293566519350495259344942192108582489235506346411106648340800185441503543243276',
  ],
  [
    100,
    'expm1',
    '0.001',
    '0.001000500166708341668055753993058311563076200580701460228514674460359748251448298412718226004153260943',
  ],
  [
    100,
    'log1p',
    '0.001',
    '0.0009995003330835331668093989205350114607550623931665519970196668289003249576587195542962547622009121511',
  ],
  [
    100,
    'sqrt',
    '2',
    '1.414213562373095048801688724209698078569671875376948073176679737990732478462107038850387534327641573',
  ],
];

describe('#1043 transcendental methods are correct to the configured precision', () => {
  for (const [precision, method, arg, expected] of ACCURACY) {
    it(`${method}(${arg}) at precision ${precision}`, () => {
      BigNumber.config({ precision });
      const x = bn(arg) as unknown as Record<string, () => BigNumber>;
      const got = x[method]();
      expect(got.toPrecision(precision)).toBe(bn(expected).toPrecision(precision));
    });
  }

  it('pi, ln 2 and ln 10 are computed to the precision asked for', () => {
    expect(BigNumber.piAt(100).toPrecision(DIGITS_100)).toBe(
      bn(
        '3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117068'
      ).toPrecision(DIGITS_100)
    );
    expect(BigNumber.ln2At(80).toPrecision(DIGITS_80)).toBe(
      bn(
        '0.6931471805599453094172321214581765680755001343602552541206800094933936219696947156058633269964186875'
      ).toPrecision(DIGITS_80)
    );
    expect(BigNumber.ln10At(70).toPrecision(DIGITS_70)).toBe(
      bn(
        '2.302585092994045684017991454684364207601101488628772976033327900967572609677352480235997205089598298'
      ).toPrecision(DIGITS_70)
    );
  });
});

describe('#1043 large arguments (oracle: mpmath, exact decimal input)', () => {
  afterEach(() => {
    BigNumber.config({ precision: 64 });
  });

  const DIGITS_25 = 25;
  const CASES: ReadonlyArray<[string, (x: BigNumber) => BigNumber, string, string]> = [
    ['sin', (x) => x.sin(), '1e300', '-0.98575042516037699660904753143'],
    ['cos', (x) => x.cos(), '-1e300', '-0.168214444374245072851875664436'],
    ['sin', (x) => x.sin(), '1e200', '0.96917148107026295906613534948'],
    ['tan', (x) => x.tan(), '1e22', '-1.62877822560689887854937593694'],
    ['exp', (x) => x.exp(), '1000', '1.97007111401704699388887935224e+434'],
    ['exp', (x) => x.exp(), '-1000', '5.07595889754945676529180947957e-435'],
    ['exp', (x) => x.exp(), '100.5', '4.43195590984589541601070619796e+43'],
    ['tanh', (x) => x.tanh(), '20', '0.999999999999999991503291489417'],
  ];

  for (const [name, f, input, expected] of CASES) {
    it(`${name}(${input}) matches mpmath to 25 digits`, () => {
      BigNumber.config({ precision: 30 });
      expect(f(new BigNumber(input)).toPrecision(DIGITS_25)).toBe(
        new BigNumber(expected).toPrecision(DIGITS_25)
      );
    });
  }

  it('exp, sinh, cosh, tanh and expm1 of +-1e300 give the limit value', () => {
    expect(new BigNumber('1e300').exp().isFinite()).toBe(false);
    expect(new BigNumber('-1e300').exp().isZero()).toBe(true);
    expect(new BigNumber('1e300').sinh().isFinite()).toBe(false);
    expect(new BigNumber('-1e300').cosh().isFinite()).toBe(false);
    expect(new BigNumber('1e300').tanh().toString()).toBe('1');
    expect(new BigNumber('-1e300').tanh().toString()).toBe('-1');
    expect(new BigNumber('-1e300').expm1().toString()).toBe('-1');
  });
});

describe('#1043 review findings', () => {
  it('toDecimalPlaces() with no argument returns the value unchanged, as decimal.js does', () => {
    expect(new BigNumber('1.2345').toDecimalPlaces().toString()).toBe('1.2345');
    expect(new BigNumber('1.2345').toDecimalPlaces(2).toString()).toBe('1.23');
  });

  it('log(base) is correctly rounded for exact powers', () => {
    expect(new BigNumber(8).log(2).toString()).toBe('3');
    expect(new BigNumber(1000).log(10).toString()).toBe('3');
    expect(new BigNumber(81).log(3).toString()).toBe('4');
  });

  it('pow of a negative base takes an integer or an infinite exponent', () => {
    expect(new BigNumber(-2).pow(new BigNumber(3)).toString()).toBe('-8');
    expect(new BigNumber(-2).pow(new BigNumber('1e20')).isFinite()).toBe(false);
    expect(new BigNumber(-2).pow(new BigNumber(Infinity)).isFinite()).toBe(false);
    expect(new BigNumber('-0.5').pow(new BigNumber(Infinity)).isZero()).toBe(true);
    expect(new BigNumber(-2).pow(new BigNumber(0.5)).isNaN()).toBe(true);
  });
});
