import { DEFAULT_STOCK_SETTINGS, ProductStatus } from '@app/models';

/**
 * Calculates the selling price excluding tax from purchase price and coefficient.
 */
export const calculateSellingPriceExclTax = (
  purchasePriceExclTax: number,
  coefficient: number,
): number => Math.round(purchasePriceExclTax * coefficient * 100) / 100;

/**
 * Calculates the selling price including tax from selling price and TVA rate.
 */
export const calculateSellingPriceInclTax = (
  sellingPriceExclTax: number,
  tvaRate: number,
): number => Math.round(sellingPriceExclTax * (1 + tvaRate) * 100) / 100;

/**
 * Determines product status based on quantity.
 */
export const calculateStatus = (quantity: number): ProductStatus =>
  quantity === 0 ? 'RUPTURE' : 'DISPONIBLE';

/**
 * Determines expiration alert level for a given date.
 */
export const getExpirationLevel = (
  expirationDate: Date | null,
  criticalDays: number = DEFAULT_STOCK_SETTINGS.expirationCriticalDays,
  warningDays: number = DEFAULT_STOCK_SETTINGS.expirationWarningDays,
): 'ok' | 'warning' | 'critical' | null => {
  if (!expirationDate) return null;

  const today = new Date();
  const diffTime = new Date(expirationDate).getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= criticalDays) return 'critical';
  if (diffDays <= warningDays) return 'warning';
  return 'ok';
};

/**
 * Determines stock alert level.
 */
export const getStockLevel = (
  quantity: number,
  alertThreshold: number,
): 'ok' | 'warning' | 'critical' => {
  if (quantity === 0) return 'critical';
  if (quantity <= alertThreshold) return 'warning';
  return 'ok';
};
