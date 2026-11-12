/**
 * Natural sort (Jim Palmer, MIT), inlined so a neutral esbuild bundle can
 * resolve it. The npm package only publishes a `main` field, which esbuild
 * ignores on `platform: 'neutral'`.
 *
 * `insensitive` matches the original `naturalSort.insensitive` flag.
 */

export interface NaturalSort {
  (a: unknown, b: unknown): number;
  insensitive?: boolean;
}

export const naturalSort: NaturalSort = function naturalSort(a: unknown, b: unknown): number {
  const re = /(^([+-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)?$|^0x[0-9a-f]+$|\d+)/gi;
  const sre = /(^[ ]*|[ ]*$)/g;
  const dre =
    /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[/\\-]\d{1,4}[/\\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/;
  const hre = /^0x[0-9a-f]+$/i;
  const ore = /^0/;
  const i = (s: unknown): string =>
    (naturalSort as NaturalSort).insensitive ? String(s).toLowerCase() : String(s);
  const x = i(a).replace(sre, '') || '';
  const y = i(b).replace(sre, '') || '';
  const xN = x.replace(re, '\0$1\0').replace(/\0$/, '').replace(/^\0/, '').split('\0');
  const yN = y.replace(re, '\0$1\0').replace(/\0$/, '').replace(/^\0/, '').split('\0');
  const xMatch = x.match(hre);
  const yMatch = y.match(hre);
  const xD =
    (xMatch ? parseInt(xMatch[0], 16) : 0) || (xN.length !== 1 && x.match(dre) && Date.parse(x));
  const yD =
    (yMatch ? parseInt(yMatch[0], 16) : 0) || (xD && y.match(dre) && Date.parse(y)) || null;
  if (yD) {
    if ((xD || 0) < yD) return -1;
    if ((xD || 0) > yD) return 1;
  }
  for (let cLoc = 0, numS = Math.max(xN.length, yN.length); cLoc < numS; cLoc++) {
    let oFxNcL: number | string =
      (!(xN[cLoc] || '').match(ore) && parseFloat(xN[cLoc] || '')) || xN[cLoc] || 0;
    let oFyNcL: number | string =
      (!(yN[cLoc] || '').match(ore) && parseFloat(yN[cLoc] || '')) || yN[cLoc] || 0;
    if (isNaN(oFxNcL as number) !== isNaN(oFyNcL as number)) {
      return isNaN(oFxNcL as number) ? 1 : -1;
    }
    if (typeof oFxNcL !== typeof oFyNcL) {
      oFxNcL = String(oFxNcL);
      oFyNcL = String(oFyNcL);
    }
    if (oFxNcL < oFyNcL) return -1;
    if (oFxNcL > oFyNcL) return 1;
  }
  return 0;
};
