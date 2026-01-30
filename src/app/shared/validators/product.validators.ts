import { min, required } from '@angular/forms/signals';
import { FrameSubType, PricingMode, ProductType } from '@app/models';

/**
 * Minimal context interface for validator conditional functions.
 * Provides valueOf() method to read field values from SchemaPath.
 *
 * Note: We use a simplified interface here because Signal Forms' internal types
 * (SchemaPath, FieldContext) use nominal typing with private symbols ([ɵɵTYPE])
 * that cannot be easily reused in generic utility functions.
 */
interface IValidatorContext {
  valueOf(path: unknown): unknown;
}

/**
 * Type for conditional validator functions used in validators' `when` option.
 */
type ValidatorCondition = (ctx: IValidatorContext) => boolean;

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
 * Note: fieldPath uses 'any' because Signal Forms' SchemaPath types use nominal
 * typing with private symbols that cannot be expressed in generic constraints.
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
export function productSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  required(fieldPath.productType);

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

  required(fieldPath.frameSubType, { when: isFrame });
  required(fieldPath.brandId, { when: isFrame });
  required(fieldPath.modelId, { when: isFrame });

  min(fieldPath.frameEyeSize, 40);
  min(fieldPath.frameBridge, 12);
  min(fieldPath.frameTemple, 120);

  required(fieldPath.lensType, { when: isLens });

  required(fieldPath.contactLensType, { when: isContactLens });
  required(fieldPath.contactLensLaboratoryId, { when: isContactLens });

  min(fieldPath.contactLensBaseCurve, 6);
  min(fieldPath.contactLensDiameter, 10);

  required(fieldPath.clipOnClipType, { when: isClipOn });

  required(fieldPath.accessoryCategory, { when: isAccessory });
}

/**
 * Helper functions interface for productSchema.
 */
export interface IProductSchemaHelpers {
  readonly isFrame: ValidatorCondition;
  readonly isLens: ValidatorCondition;
  readonly isContactLens: ValidatorCondition;
  readonly isClipOn: ValidatorCondition;
  readonly isAccessory: ValidatorCondition;
  readonly isSafetyFrame: ValidatorCondition;
  readonly isCoefficient: ValidatorCondition;
  readonly isFixedAmount: ValidatorCondition;
  readonly isFixedPrice: ValidatorCondition;
}

/**
 * Creates helper functions for productSchema based on fieldPath.
 *
 * Note: fieldPath uses 'any' because Signal Forms' SchemaPath types use nominal
 * typing with private symbols that cannot be expressed in generic constraints.
 *
 * @param fieldPath - The fieldPath from form() callback
 * @returns Helper functions for conditional validation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProductSchemaHelpers(fieldPath: any): IProductSchemaHelpers {
  const isFrame: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'frame';

  const isLens: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'lens';

  const isContactLens: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'contact_lens';

  const isClipOn: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'clip_on';

  const isAccessory: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.productType) as ProductType | null) === 'accessory';

  const isSafetyFrame: ValidatorCondition = (ctx) => {
    const type = ctx.valueOf(fieldPath.productType) as ProductType | null;
    const subType = ctx.valueOf(fieldPath.frameSubType) as FrameSubType | null;
    return type === 'frame' && subType === 'safety';
  };

  const isCoefficient: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.pricingMode) as PricingMode | null) === 'coefficient';

  const isFixedAmount: ValidatorCondition = (ctx) =>
    (ctx.valueOf(fieldPath.pricingMode) as PricingMode | null) === 'fixedAmount';

  const isFixedPrice: ValidatorCondition = (ctx) =>
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
 *
 * Note: rowPath uses 'any' because Signal Forms' SchemaPath types use nominal
 * typing with private symbols that cannot be expressed in generic constraints.
 *
 * @param rowPath - The row fieldPath from applyEach() callback
 * @returns Helper functions for conditional validation (new products only)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createStockEntryProductSchemaHelpers(rowPath: any): IProductSchemaHelpers {
  const isNewProduct = (ctx: IValidatorContext): boolean => ctx.valueOf(rowPath.id) === null;

  const getProductType = (ctx: IValidatorContext): ProductType | null =>
    ctx.valueOf(rowPath.productType) as ProductType | null;

  const getFrameSubType = (ctx: IValidatorContext): FrameSubType | null =>
    ctx.valueOf(rowPath.frameSubType) as FrameSubType | null;

  const getPricingMode = (ctx: IValidatorContext): PricingMode | null =>
    ctx.valueOf(rowPath.pricingMode) as PricingMode | null;

  const isFrame: ValidatorCondition = (ctx) => isNewProduct(ctx) && getProductType(ctx) === 'frame';

  const isLens: ValidatorCondition = (ctx) => isNewProduct(ctx) && getProductType(ctx) === 'lens';

  const isContactLens: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getProductType(ctx) === 'contact_lens';

  const isClipOn: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getProductType(ctx) === 'clip_on';

  const isAccessory: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getProductType(ctx) === 'accessory';

  const isSafetyFrame: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getProductType(ctx) === 'frame' && getFrameSubType(ctx) === 'safety';

  const isCoefficient: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getPricingMode(ctx) === 'coefficient';

  const isFixedAmount: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getPricingMode(ctx) === 'fixedAmount';

  const isFixedPrice: ValidatorCondition = (ctx) =>
    isNewProduct(ctx) && getPricingMode(ctx) === 'fixedPrice';

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
