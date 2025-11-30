/**
 * Calculer le prix ht à partir du ttc, tv et la redevance
 * @param ttc
 * @param tauxTva
 * @param soumis_redevance
 * @param redevance
 * @return number prix_ht
 */
export const CalculateHTPriceFromTTC = (
  ttc: number,
  tauxTva: number,
  soumis_redevance = false,
  redevance = 0
): number => (soumis_redevance ? ttc + redevance : ttc) / (1 + tauxTva / 100);
