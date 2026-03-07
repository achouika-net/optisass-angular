/**
 * Génère une chaîne alphanumérique aléatoire de la longueur spécifiée
 * @param {number} length
 * @return {string}
 */
export const randomAlphaNumeric = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (byte) => chars[byte % chars.length]).join(
    ''
  );
};
