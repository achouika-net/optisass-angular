import { maxLength, pattern, required } from '@angular/forms/signals';

/**
 * Reusable validation schema for address fields.
 * Applies required, maxLength, and pattern validators.
 *
 * By default, street, postcode, and city are required.
 * Pass `false` to make address optional.
 *
 * @param addressFieldPath - The fieldPath.address from form() callback
 * @param isRequired - If true (default), street, postcode, and city are required
 *
 * @example
 * ```typescript
 * // Required address (default)
 * AddressSchema(fieldPath.address);
 * ```
 *
 * @example
 * ```typescript
 * // Optional address
 * AddressSchema(fieldPath.address, false);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AddressSchema(addressFieldPath: any, isRequired = true): void {
  // Required validators (only if isRequired is true)
  if (isRequired) {
    required(addressFieldPath.street);
    required(addressFieldPath.postcode);
    required(addressFieldPath.city);
  }

  // Format validators (always applied)
  maxLength(addressFieldPath.street, 200);
  maxLength(addressFieldPath.streetLine2, 100);
  maxLength(addressFieldPath.city, 100);

  // Postcode format: 5 digits (France/Morocco)
  pattern(addressFieldPath.postcode, /^\d{5}$/);
}
