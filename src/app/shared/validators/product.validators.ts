import { min, required } from '@angular/forms/signals';
import { FrameSubType, PricingMode, ProductType } from '@optisaas/opti-saas-lib';

/**
 * Options for productSchema to customize validation behavior.
 */
export interface IProductSchemaOptions {
  /** Whether to validate alertThreshold (default: false - OCR fills it). */
  readonly validateAlertThreshold?: boolean;
  /** Whether to validate designation as required (default: false). */
  readonly validateDesignation?: boolean;
  /** Whether to validate pricing fields (default: false - OCR fills them). */
  readonly validatePricing?: boolean;
}

/**
 * Shared product validation schema - MINIMAL for fast creation.
 *
 * Philosophy: Only the absolute minimum fields are required for product creation.
 * OCR fills as many fields as possible automatically.
 * All other fields are optional but can be enriched via OCR or manual input.
 *
 * Required fields per type:
 * - Frame: productType + frameSubType + brandId + modelId
 * - Lens: productType + lensType
 * - Contact Lens: productType + contactLensType + contactLensLaboratoryId
 * - Clip-on: productType + clipOnClipType
 * - Accessory: productType + accessoryCategory
 *
 * @param fieldPath - The fieldPath from form() callback
 * @param helpers - Context helper functions for conditional validation
 * @param options - Optional configuration for validation behavior
 *
 * @example
 * ```typescript
 * // In product-form.component.ts
 * readonly form = form(this.#formModel, (fieldPath) => {
 *   const helpers = createProductSchemaHelpers(fieldPath);
 *   productSchema(fieldPath, helpers);
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function productSchema(
  fieldPath: any,
  helpers: IProductSchemaHelpers,
  options?: IProductSchemaOptions,
): void {
  const {
    isFrame,
    isLens,
    isContactLens,
    isClipOn,
    isAccessory,
    isCoefficient,
    isFixedAmount,
    isFixedPrice,
  } = helpers;
  const validateAlertThreshold = options?.validateAlertThreshold ?? false;
  const validatePricing = options?.validatePricing ?? false;

  // Common required fields (only productType is truly required)
  required(fieldPath.productType);

  // Optional pricing validation (for full product forms, not stock-entry)
  if (validatePricing) {
    required(fieldPath.pricingMode);
    required(fieldPath.tvaRate);
    min(fieldPath.tvaRate, 0);

    required(fieldPath.coefficient, { when: isCoefficient });
    min(fieldPath.coefficient, 0);
    required(fieldPath.fixedAmount, { when: isFixedAmount });
    min(fieldPath.fixedAmount, 0);
    required(fieldPath.fixedPrice, { when: isFixedPrice });
    min(fieldPath.fixedPrice, 0);
  }

  if (validateAlertThreshold) {
    required(fieldPath.alertThreshold);
    min(fieldPath.alertThreshold, 0);
  }

  // Frame fields (minimal: frameSubType + brandId + modelId)
  required(fieldPath.frameSubType, { when: isFrame });
  required(fieldPath.brandId, { when: isFrame });
  required(fieldPath.modelId, { when: isFrame });

  // Optional frame field constraints (OCR fills, not required)
  min(fieldPath.frameEyeSize, 40);
  min(fieldPath.frameBridge, 12);
  min(fieldPath.frameTemple, 120);

  // Lens fields (minimal: lensType only)
  required(fieldPath.lensType, { when: isLens });

  // Contact lens fields (minimal: contactLensType + laboratoryId)
  required(fieldPath.contactLensType, { when: isContactLens });
  required(fieldPath.contactLensLaboratoryId, { when: isContactLens });

  // Optional contact lens field constraints (OCR fills, not required)
  min(fieldPath.contactLensBaseCurve, 6);
  min(fieldPath.contactLensDiameter, 10);

  // Clip-on fields (minimal: clipOnClipType only)
  required(fieldPath.clipOnClipType, { when: isClipOn });

  // Accessory fields (minimal: accessoryCategory only)
  required(fieldPath.accessoryCategory, { when: isAccessory });
}

/**
 * Helper functions interface for productSchema.
 */
export interface IProductSchemaHelpers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isFrame: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isLens: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isContactLens: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isClipOn: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isAccessory: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isSafetyFrame: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isCoefficient: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isFixedAmount: (ctx: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly isFixedPrice: (ctx: any) => boolean;
}

/**
 * Creates helper functions for productSchema based on fieldPath.
 * @param fieldPath - The fieldPath from form() callback
 * @returns Helper functions for conditional validation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProductSchemaHelpers(fieldPath: any): IProductSchemaHelpers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isFrame = (ctx: any) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'frame';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLens = (ctx: any) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'lens';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isContactLens = (ctx: any) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'contact_lens';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isClipOn = (ctx: any) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'clip_on';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAccessory = (ctx: any) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'accessory';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSafetyFrame = (ctx: any) => {
    const type = ctx.valueOf(fieldPath.productType) as ProductType | null;
    const subType = ctx.valueOf(fieldPath.frameSubType) as FrameSubType | null;
    return type === 'frame' && subType === 'safety';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCoefficient = (ctx: any) =>
    (ctx.valueOf(fieldPath.pricingMode) as PricingMode | null) === 'coefficient';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isFixedAmount = (ctx: any) =>
    (ctx.valueOf(fieldPath.pricingMode) as PricingMode | null) === 'fixedAmount';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isFixedPrice = (ctx: any) =>
    (ctx.valueOf(fieldPath.pricingMode) as PricingMode | null) === 'fixedPrice';

  return {
    isFrame,
    isLens,
    isContactLens,
    isClipOn,
    isAccessory,
    isSafetyFrame,
    isCoefficient,
    isFixedAmount,
    isFixedPrice,
  };
}

/**
 * Creates helper functions for productSchema in stock-entry context.
 * All conditions are wrapped with isNewProduct check.
 * @param rowPath - The row fieldPath from applyEach() callback
 * @returns Helper functions for conditional validation (new products only)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStockEntryProductSchemaHelpers(rowPath: any): IProductSchemaHelpers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNewProduct = (ctx: any) => ctx.valueOf(rowPath.id) === null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getProductType = (ctx: any) => ctx.valueOf(rowPath.productType) as ProductType | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFrameSubType = (ctx: any) => ctx.valueOf(rowPath.frameSubType) as FrameSubType | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPricingMode = (ctx: any) => ctx.valueOf(rowPath.pricingMode) as PricingMode | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isFrame = (ctx: any) => isNewProduct(ctx) && getProductType(ctx) === 'frame';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isLens = (ctx: any) => isNewProduct(ctx) && getProductType(ctx) === 'lens';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isContactLens = (ctx: any) => isNewProduct(ctx) && getProductType(ctx) === 'contact_lens';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isClipOn = (ctx: any) => isNewProduct(ctx) && getProductType(ctx) === 'clip_on';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAccessory = (ctx: any) => isNewProduct(ctx) && getProductType(ctx) === 'accessory';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSafetyFrame = (ctx: any) =>
    isNewProduct(ctx) && getProductType(ctx) === 'frame' && getFrameSubType(ctx) === 'safety';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isCoefficient = (ctx: any) => isNewProduct(ctx) && getPricingMode(ctx) === 'coefficient';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isFixedAmount = (ctx: any) => isNewProduct(ctx) && getPricingMode(ctx) === 'fixedAmount';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isFixedPrice = (ctx: any) => isNewProduct(ctx) && getPricingMode(ctx) === 'fixedPrice';

  return {
    isFrame,
    isLens,
    isContactLens,
    isClipOn,
    isAccessory,
    isSafetyFrame,
    isCoefficient,
    isFixedAmount,
    isFixedPrice,
  };
}
