import {
  IProductPhoto,
  ISupplierProductCode,
  PricingMode,
  Product,
  ProductType,
} from '@optisaas/opti-saas-lib';
import { FrameSubType } from './index';
import {
  IAccessoryCreateRequest,
  IClipOnCreateRequest,
  IContactLensCreateRequest,
  IFrameCreateRequest,
  ILensCreateRequest,
  ProductCreateRequest,
  ProductUpdateRequest,
} from './product-request.model';

export interface ISupplierProductCodeForm {
  supplierId: string | null;
  code: string;
}

export interface IProductForm {
  productType: ProductType | null;
  designation: string | null;
  brandId: string | null;
  modelId: string | null;
  color: string | null;
  supplierIds: string[];
  familyId: string | null;
  subFamilyId: string | null;
  photo: string | null;

  // Codes produits pour matching OCR
  manufacturerRef: string | null;
  supplierCodes: ISupplierProductCodeForm[];

  purchasePriceExclTax: number | null;
  pricingMode: PricingMode;
  coefficient: number | null;
  fixedAmount: number | null;
  fixedPrice: number | null;
  tvaRate: number | null;
  alertThreshold: number | null;

  // Frame fields (Option C: unified frame type with subType)
  frameSubType: FrameSubType | null;
  frameGender: string | null;
  frameShape: string | null;
  frameMaterial: string | null;
  frameType: string | null;
  frameHingeType: string | null;
  frameEyeSize: number | null;
  frameBridge: number | null;
  frameTemple: number | null;
  frameColor: string | null;
  frameTempleColor: string | null;
  frameFinish: string | null;
  frameFrontPhoto: string | null;
  frameSidePhoto: string | null;

  // Safety-specific fields (only when frameSubType === 'safety')
  safetySafetyStandard: string | null;
  safetySafetyRating: string | null;
  safetyProtectionType: string | null;
  safetyLensIncluded: boolean;
  safetyPrescriptionCapable: boolean;

  // Lens fields
  lensType: string | null;
  lensMaterial: string | null;
  lensRefractiveIndex: string | null;
  lensTint: string | null;
  lensFilters: string[];
  lensTreatments: string[];
  lensManufacturerId: string | null;
  lensOpticalFamily: string | null;
  lensSpherePower: number | null;
  lensCylinderPower: number | null;
  lensAxis: number | null;
  lensAddition: number | null;
  lensDiameter: number | null;
  lensBaseCurve: number | null;

  // Contact lens fields
  contactLensType: string | null;
  contactLensUsage: string | null;
  contactLensLaboratoryId: string | null;
  contactLensCommercialModel: string | null;
  contactLensBaseCurve: number | null;
  contactLensDiameter: number | null;
  contactLensQuantityPerBox: number | null;
  contactLensPricePerBox: number | null;
  contactLensPricePerUnit: number | null;
  contactLensExpirationDate: Date | null;
  contactLensSpherePower: number | null;
  contactLensCylinder: number | null;
  contactLensAxis: number | null;
  contactLensAddition: number | null;

  // Clip-on fields
  clipOnClipType: string | null;
  clipOnPolarized: boolean;
  clipOnMirrorCoating: boolean;
  clipOnTint: string | null;
  clipOnCompatibleFrameSize: string | null;

  // Accessory fields
  accessoryCategory: string | null;
  accessorySubCategory: string | null;
}

const DEFAULT_PRODUCT_FORM: IProductForm = {
  productType: null,
  designation: null,
  brandId: null,
  modelId: null,
  color: null,
  supplierIds: [],
  familyId: null,
  subFamilyId: null,
  photo: null,

  // Codes produits pour matching OCR
  manufacturerRef: null,
  supplierCodes: [],

  purchasePriceExclTax: null,
  pricingMode: 'coefficient',
  coefficient: 2.5,
  fixedAmount: null,
  fixedPrice: null,
  tvaRate: 0.2,
  alertThreshold: 2,

  // Frame fields
  frameSubType: null,
  frameGender: null,
  frameShape: null,
  frameMaterial: null,
  frameType: null,
  frameHingeType: null,
  frameEyeSize: null,
  frameBridge: null,
  frameTemple: null,
  frameColor: null,
  frameTempleColor: null,
  frameFinish: null,
  frameFrontPhoto: null,
  frameSidePhoto: null,

  // Safety-specific fields
  safetySafetyStandard: null,
  safetySafetyRating: null,
  safetyProtectionType: null,
  safetyLensIncluded: false,
  safetyPrescriptionCapable: false,

  // Lens fields
  lensType: null,
  lensMaterial: null,
  lensRefractiveIndex: null,
  lensTint: null,
  lensFilters: [],
  lensTreatments: [],
  lensManufacturerId: null,
  lensOpticalFamily: null,
  lensSpherePower: null,
  lensCylinderPower: null,
  lensAxis: null,
  lensAddition: null,
  lensDiameter: null,
  lensBaseCurve: null,

  // Contact lens fields
  contactLensType: null,
  contactLensUsage: null,
  contactLensLaboratoryId: null,
  contactLensCommercialModel: null,
  contactLensBaseCurve: null,
  contactLensDiameter: null,
  contactLensQuantityPerBox: null,
  contactLensPricePerBox: null,
  contactLensPricePerUnit: null,
  contactLensExpirationDate: null,
  contactLensSpherePower: null,
  contactLensCylinder: null,
  contactLensAxis: null,
  contactLensAddition: null,

  // Clip-on fields
  clipOnClipType: null,
  clipOnPolarized: false,
  clipOnMirrorCoating: false,
  clipOnTint: null,
  clipOnCompatibleFrameSize: null,

  // Accessory fields
  accessoryCategory: null,
  accessorySubCategory: null,
};

/**
 * Returns a fresh copy of the default form.
 * @returns A new IProductForm object with default values
 */
export function getDefaultProductForm(): IProductForm {
  return {
    ...DEFAULT_PRODUCT_FORM,
    supplierIds: [],
    supplierCodes: [],
    lensFilters: [],
    lensTreatments: [],
  };
}

/**
 * Converts a base64 string or URL to IProductPhoto object.
 * @param value The photo value (base64, URL or null)
 * @returns The IProductPhoto object or null
 */
function toProductPhoto(value: string | null): IProductPhoto | null {
  if (!value) return null;
  if (value.startsWith('data:')) {
    return { url: null, base64: value };
  }
  return { url: value, base64: null };
}

/**
 * Converts ISupplierProductCode[] to ISupplierProductCodeForm[].
 * @param codes The supplier codes from product
 * @returns The form-compatible supplier codes
 */
function toSupplierCodesForms(
  codes: readonly ISupplierProductCode[] | undefined,
): ISupplierProductCodeForm[] {
  if (!codes) return [];
  return codes.map((c) => ({
    supplierId: c.supplierId,
    code: c.code,
  }));
}

/**
 * Converts ISupplierProductCodeForm[] to ISupplierProductCode[].
 * @param forms The form supplier codes
 * @returns The product-compatible supplier codes
 */
function toSupplierCodes(forms: ISupplierProductCodeForm[]): ISupplierProductCode[] {
  return forms
    .filter((f) => f.supplierId && f.code)
    .map(
      (f): ISupplierProductCode => ({
        supplierId: f.supplierId!,
        code: f.code,
        lastPurchasePrice: null,
        lastPurchaseDate: null,
      }),
    );
}

/**
 * Converts a Product to IProductForm for editing.
 * @param product The product to convert
 * @returns The form data
 */
export function toFormData(product: Product): IProductForm {
  const p = product as any;
  const formData: IProductForm = {
    ...getDefaultProductForm(),
    productType: p.productType ?? null,
    designation: p.designation ?? null,
    brandId: p.brandId ?? null,
    modelId: p.modelId ?? null,
    color: p.color ?? null,
    supplierIds: p.supplierIds ?? [],
    familyId: p.familyId ?? null,
    subFamilyId: p.subFamilyId ?? null,
    photo: p.photo?.url ?? null,
    manufacturerRef: p.manufacturerRef ?? null,
    supplierCodes: toSupplierCodesForms(p.supplierCodes),
    purchasePriceExclTax: p.purchasePriceExclTax ?? null,
    pricingMode: p.pricingMode ?? 'fixedPrice',
    coefficient: p.coefficient ?? null,
    fixedAmount: p.fixedAmount ?? null,
    fixedPrice: p.fixedPrice ?? null,
    tvaRate: p.tvaRate ?? 20,
    alertThreshold: p.alertThreshold ?? null,
  };

  if (p.productType === 'frame') {
    formData.frameSubType = p.frameSubType;
    formData.frameGender = p.gender;
    formData.frameShape = p.shape;
    formData.frameMaterial = p.material;
    formData.frameType = p.frameType;
    formData.frameHingeType = p.hingeType;
    formData.frameEyeSize = p.eyeSize || p.caliber;
    formData.frameBridge = p.bridge;
    formData.frameTemple = p.temple;
    formData.frameColor = p.frameColor;
    formData.frameTempleColor = p.templeColor;
    formData.frameFinish = p.frameFinish;
    formData.frameFrontPhoto = p.frontPhoto?.url ?? null;
    formData.frameSidePhoto = p.sidePhoto?.url ?? null;
    if (p.frameSubType === 'safety') {
      formData.safetySafetyStandard = p.safetyStandard;
      formData.safetySafetyRating = p.safetyRating;
      formData.safetyProtectionType = p.protectionType;
      formData.safetyLensIncluded = p.lensIncluded;
      formData.safetyPrescriptionCapable = p.prescriptionCapable;
    }
  }

  if (p.productType === 'lens') {
    formData.lensType = p.lensType;
    formData.lensMaterial = p.material;
    formData.lensRefractiveIndex = p.refractiveIndex?.toString() ?? null;
    formData.lensTint = p.tint;
    formData.lensFilters = p.filters ?? [];
    formData.lensTreatments = p.treatments ?? [];
    formData.lensManufacturerId = p.manufacturerId || p.manufacturer;
    formData.lensOpticalFamily = p.opticalFamily;
    formData.lensSpherePower = p.spherePower;
    formData.lensCylinderPower = p.cylinderPower;
    formData.lensAxis = p.axis;
    formData.lensAddition = p.addition;
    formData.lensDiameter = p.diameter;
    formData.lensBaseCurve = p.baseCurve;
  }

  if (p.productType === 'contact_lens') {
    formData.contactLensType = p.contactLensType;
    formData.contactLensUsage = p.usage;
    formData.contactLensLaboratoryId = p.laboratoryId;
    formData.contactLensCommercialModel = p.commercialModel;
    formData.contactLensBaseCurve = p.baseCurve;
    formData.contactLensDiameter = p.diameter;
    formData.contactLensQuantityPerBox = p.quantityPerBox;
    formData.contactLensPricePerBox = p.pricePerBox;
    formData.contactLensPricePerUnit = p.pricePerUnit;
    formData.contactLensExpirationDate = p.expirationDate;
    formData.contactLensSpherePower = p.spherePower;
    formData.contactLensCylinder = p.cylinder;
    formData.contactLensAxis = p.axis;
    formData.contactLensAddition = p.addition;
  }

  if (p.productType === 'clip_on') {
    formData.clipOnClipType = p.clipType;
    formData.clipOnPolarized = p.polarized;
    formData.clipOnMirrorCoating = p.mirrorCoating;
    formData.clipOnTint = p.tint;
    formData.clipOnCompatibleFrameSize = p.compatibleFrameSize;
  }

  if (p.productType === 'accessory') {
    formData.accessoryCategory = p.category;
    formData.accessorySubCategory = p.subCategory;
  }

  return formData;
}

/**
 * Resets type-specific fields to their default values while preserving common fields.
 * @param form The current form data
 * @returns A new form object with type-specific fields reset to defaults
 */
export function resetTypeSpecificFields(form: IProductForm): IProductForm {
  const defaults = getDefaultProductForm();
  return {
    ...form,
    frameSubType: defaults.frameSubType,
    frameGender: defaults.frameGender,
    frameShape: defaults.frameShape,
    frameMaterial: defaults.frameMaterial,
    frameType: defaults.frameType,
    frameHingeType: defaults.frameHingeType,
    frameEyeSize: defaults.frameEyeSize,
    frameBridge: defaults.frameBridge,
    frameTemple: defaults.frameTemple,
    frameColor: defaults.frameColor,
    frameTempleColor: defaults.frameTempleColor,
    frameFinish: defaults.frameFinish,
    frameFrontPhoto: defaults.frameFrontPhoto,
    frameSidePhoto: defaults.frameSidePhoto,
    safetySafetyStandard: defaults.safetySafetyStandard,
    safetySafetyRating: defaults.safetySafetyRating,
    safetyProtectionType: defaults.safetyProtectionType,
    safetyLensIncluded: defaults.safetyLensIncluded,
    safetyPrescriptionCapable: defaults.safetyPrescriptionCapable,
    lensType: defaults.lensType,
    lensMaterial: defaults.lensMaterial,
    lensRefractiveIndex: defaults.lensRefractiveIndex,
    lensTint: defaults.lensTint,
    lensFilters: [],
    lensTreatments: [],
    lensManufacturerId: defaults.lensManufacturerId,
    lensOpticalFamily: defaults.lensOpticalFamily,
    lensSpherePower: defaults.lensSpherePower,
    lensCylinderPower: defaults.lensCylinderPower,
    lensAxis: defaults.lensAxis,
    lensAddition: defaults.lensAddition,
    lensDiameter: defaults.lensDiameter,
    lensBaseCurve: defaults.lensBaseCurve,
    contactLensType: defaults.contactLensType,
    contactLensUsage: defaults.contactLensUsage,
    contactLensLaboratoryId: defaults.contactLensLaboratoryId,
    contactLensCommercialModel: defaults.contactLensCommercialModel,
    contactLensBaseCurve: defaults.contactLensBaseCurve,
    contactLensDiameter: defaults.contactLensDiameter,
    contactLensQuantityPerBox: defaults.contactLensQuantityPerBox,
    contactLensPricePerBox: defaults.contactLensPricePerBox,
    contactLensPricePerUnit: defaults.contactLensPricePerUnit,
    contactLensExpirationDate: defaults.contactLensExpirationDate,
    contactLensSpherePower: defaults.contactLensSpherePower,
    contactLensCylinder: defaults.contactLensCylinder,
    contactLensAxis: defaults.contactLensAxis,
    contactLensAddition: defaults.contactLensAddition,
    clipOnClipType: defaults.clipOnClipType,
    clipOnPolarized: defaults.clipOnPolarized,
    clipOnMirrorCoating: defaults.clipOnMirrorCoating,
    clipOnTint: defaults.clipOnTint,
    clipOnCompatibleFrameSize: defaults.clipOnCompatibleFrameSize,
    accessoryCategory: defaults.accessoryCategory,
    accessorySubCategory: defaults.accessorySubCategory,
  };
}

/**
 * Converts IProductForm to ProductCreateRequest.
 * @param form The form data
 * @returns The create request typed according to the product type
 */
export function toProductCreateRequest(form: IProductForm): ProductCreateRequest {
  const baseRequest = {
    designation: form.designation,
    brandId: form.brandId,
    modelId: form.modelId,
    color: form.color,
    supplierIds: form.supplierIds,
    familyId: form.familyId,
    subFamilyId: form.subFamilyId,
    alertThreshold: form.alertThreshold ?? 2,
    manufacturerRef: form.manufacturerRef,
    supplierCodes: toSupplierCodes(form.supplierCodes),
    pricingMode: form.pricingMode,
    coefficient: form.coefficient,
    fixedAmount: form.fixedAmount,
    fixedPrice: form.fixedPrice,
    tvaRate: form.tvaRate ?? 0.2,
    purchasePriceExclTax: form.purchasePriceExclTax,
    photo: toProductPhoto(form.photo),
  };

  switch (form.productType) {
    case 'frame':
      return {
        ...baseRequest,
        productType: 'frame',
        frameSubType: form.frameSubType!,
        shape: form.frameShape,
        material: form.frameMaterial,
        eyeSize: form.frameEyeSize,
        bridge: form.frameBridge,
        temple: form.frameTemple,
        frameType: form.frameType,
        gender: form.frameGender,
        hingeType: form.frameHingeType,
        frameColor: form.frameColor,
        templeColor: form.frameTempleColor,
        frameFinish: form.frameFinish,
        frontPhoto: toProductPhoto(form.frameFrontPhoto),
        sidePhoto: toProductPhoto(form.frameSidePhoto),
        safetyStandard: form.frameSubType === 'safety' ? form.safetySafetyStandard : null,
        safetyRating: form.frameSubType === 'safety' ? form.safetySafetyRating : null,
        protectionType: form.frameSubType === 'safety' ? form.safetyProtectionType : null,
        lensIncluded: form.frameSubType === 'safety' ? form.safetyLensIncluded : false,
        prescriptionCapable:
          form.frameSubType === 'safety' ? form.safetyPrescriptionCapable : false,
      } as IFrameCreateRequest;

    case 'lens':
      return {
        ...baseRequest,
        productType: 'lens',
        lensType: form.lensType!,
        material: form.lensMaterial!,
        refractiveIndex: form.lensRefractiveIndex,
        tint: form.lensTint,
        filters: form.lensFilters.length > 0 ? form.lensFilters : null,
        treatments: form.lensTreatments.length > 0 ? form.lensTreatments : null,
        spherePower: form.lensSpherePower,
        cylinderPower: form.lensCylinderPower,
        axis: form.lensAxis,
        addition: form.lensAddition,
        diameter: form.lensDiameter,
        baseCurve: form.lensBaseCurve,
        curvature: null,
        manufacturerId: form.lensManufacturerId,
        opticalFamily: form.lensOpticalFamily,
      } as ILensCreateRequest;

    case 'contact_lens':
      return {
        ...baseRequest,
        productType: 'contact_lens',
        contactLensType: form.contactLensType!,
        usage: form.contactLensUsage!,
        laboratoryId: form.contactLensLaboratoryId,
        commercialModel: form.contactLensCommercialModel,
        spherePower: form.contactLensSpherePower,
        cylinder: form.contactLensCylinder,
        axis: form.contactLensAxis,
        addition: form.contactLensAddition,
        baseCurve: form.contactLensBaseCurve ?? 8.6,
        diameter: form.contactLensDiameter ?? 14.2,
        quantityPerBox: form.contactLensQuantityPerBox ?? 30,
        pricePerBox: form.contactLensPricePerBox ?? 0,
        pricePerUnit: form.contactLensPricePerUnit ?? 0,
        batchNumber: null,
        expirationDate: form.contactLensExpirationDate,
        boxQuantity: null,
        unitQuantity: null,
      } as IContactLensCreateRequest;

    case 'clip_on':
      return {
        ...baseRequest,
        productType: 'clip_on',
        clipType: form.clipOnClipType!,
        polarized: form.clipOnPolarized,
        mirrorCoating: form.clipOnMirrorCoating,
        tint: form.clipOnTint,
        compatibleFrameSize: form.clipOnCompatibleFrameSize,
      } as IClipOnCreateRequest;

    case 'accessory':
      return {
        ...baseRequest,
        productType: 'accessory',
        category: form.accessoryCategory!,
        subCategory: form.accessorySubCategory,
      } as IAccessoryCreateRequest;

    default:
      throw new Error(`Unknown product type: ${form.productType}`);
  }
}

/**
 * Converts IProductForm to ProductUpdateRequest.
 * @param id The product ID to update
 * @param form The form data
 * @returns The update request
 */
export function toProductUpdateRequest(id: string, form: IProductForm): ProductUpdateRequest {
  const createRequest = toProductCreateRequest(form);
  return {
    ...createRequest,
    id,
  } as ProductUpdateRequest;
}

/**
 * Product validation rules reference.
 *
 * Signal Forms validators are strongly typed and cannot be abstracted into
 * a reusable function. This documentation serves as a reference for the
 * validation rules that should be applied to product forms.
 *
 * ## Philosophy: Minimal required for fast creation
 * Only the absolute minimum fields are required for product creation.
 * OCR fills as many fields as possible automatically.
 * All other fields are optional but can be enriched via OCR or manual input.
 *
 * ## Common fields (all product types):
 * - productType: required
 *
 * ## Frame fields (productType === 'frame'):
 * - frameSubType: required (optical, sun, safety, sport, reading)
 * - brandId: required
 * - modelId: required
 *
 * ## Lens fields (productType === 'lens'):
 * - lensType: required
 *
 * ## Contact lens fields (productType === 'contact_lens'):
 * - contactLensType: required
 * - contactLensLaboratoryId: required
 *
 * ## Clip-on fields (productType === 'clip_on'):
 * - clipOnClipType: required
 *
 * ## Accessory fields (productType === 'accessory'):
 * - accessoryCategory: required
 *
 * ## OCR-extractable fields (not required, auto-filled when available):
 * - Frame: eyeSize, bridge, temple, frameColor, frameFinish, gender, shape, material
 * - Lens: material, refractiveIndex, filters, treatments, spherePower, cylinderPower
 * - Contact Lens: baseCurve, diameter, spherePower, cylinder, axis, addition
 * - Clip-on: polarized, tint, mirrorCoating
 * - Safety: safetyStandard, safetyRating, protectionType
 *
 * @see ProductFormComponent for implementation example
 * @see stock-entry-row for OCR form display
 */
export const PRODUCT_VALIDATION_RULES = {
  common: ['productType'],
  frame: ['frameSubType', 'brandId', 'modelId'],
  lens: ['lensType'],
  contactLens: ['contactLensType', 'contactLensLaboratoryId'],
  clipOn: ['clipOnClipType'],
  accessory: ['accessoryCategory'],
} as const;
