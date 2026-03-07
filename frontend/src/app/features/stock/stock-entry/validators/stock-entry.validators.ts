import { IWarehouseAllocation } from '../models';

/**
 * Validates warehouse allocations for a stock entry product.
 * Ensures at least one warehouse is assigned and total quantity is positive.
 *
 * @param context - Validation context containing value accessor
 * @returns Validation error object or null if valid
 *
 * @example
 * ```typescript
 * validate(rowPath.warehouseAllocations, validateWarehouseAllocations);
 * ```
 */
export const validateWarehouseAllocations = ({ value }: { value: () => unknown }) => {
  const allocations = value() as readonly IWarehouseAllocation[] | null;

  if (!allocations || allocations.length === 0) {
    return { kind: 'required', message: 'stock.entry.validation.warehouseRequired' };
  }

  const totalQty = allocations.reduce((sum, a) => sum + a.quantity, 0);
  if (totalQty <= 0) {
    return { kind: 'min', message: 'stock.entry.validation.quantityMin' };
  }

  return null;
};
