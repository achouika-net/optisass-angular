/**
 * Compare deux valeurs pour le tri
 * @param {string | number | Date} a - Première valeur à comparer
 * @param {string | number | Date} b - Deuxième valeur à comparer
 * @param {boolean} isAsc - True pour tri ascendant, false pour tri descendant
 * @returns {number} -1 si a < b, 1 si a > b, 0 si égaux (ajusté selon la direction)
 */
export function compare(
  a: string | number | Date,
  b: string | number | Date,
  isAsc: boolean
): number {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}

/**
 * Compare deux chaînes de caractères en ignorant la casse
 * @param {string} a - Première chaîne à comparer
 * @param {string} b - Deuxième chaîne à comparer
 * @param {boolean} isAsc - True pour tri ascendant, false pour tri descendant
 * @returns {number} -1 si a < b, 1 si a > b, 0 si égaux (ajusté selon la direction)
 */
export function compareIgnoreCase(
  a: string,
  b: string,
  isAsc: boolean
): number {
  return compare(a.toLowerCase(), b.toLowerCase(), isAsc);
}

/**
 * Compare deux dates
 * @param {Date | string} a - Première date à comparer
 * @param {Date | string} b - Deuxième date à comparer
 * @param {boolean} isAsc - True pour tri ascendant, false pour tri descendant
 * @returns {number} -1 si a < b, 1 si a > b, 0 si égaux (ajusté selon la direction)
 */
export function compareDates(
  a: Date | string,
  b: Date | string,
  isAsc: boolean
): number {
  const dateA = a instanceof Date ? a : new Date(a);
  const dateB = b instanceof Date ? b : new Date(b);
  return compare(dateA, dateB, isAsc);
}
