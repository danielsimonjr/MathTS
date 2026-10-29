export interface UnivariateTerm {
  zero: boolean;
  negative: boolean;
  absText: string;
  absIsOne: boolean;
}

/**
 * Descending-power univariate printer shared by number and bigint coefficient paths.
 */
export function renderDescendingUnivariate(
  length: number,
  coeffAt: (power: number) => UnivariateTerm,
  variable: string
): string {
  const parts: string[] = [];
  for (let i = length - 1; i >= 0; i -= 1) {
    const { zero, negative, absText, absIsOne } = coeffAt(i);
    if (zero) continue;
    let term: string;
    if (i === 0) {
      term = absText;
    } else {
      const varPart = i === 1 ? variable : `${variable}^${i}`;
      term = absIsOne ? varPart : `${absText}*${varPart}`;
    }
    if (parts.length === 0) {
      parts.push(negative ? `-${term}` : term);
    } else {
      parts.push(negative ? '-' : '+', term);
    }
  }
  return parts.length === 0 ? '0' : parts.join(' ');
}
