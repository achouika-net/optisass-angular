import { IProductPhoto, PricingMode, Product, ProductType } from '@app/models';
import {
  IAccessoryCreateRequest,
  IContactLensCreateRequest,
  IFrameCreateRequest,
  ILensCreateRequest,
  ProductCreateRequest,
  ProductUpdateRequest,
} from './product-request.model';

export interface IProductForm {
  // Common fields
  productType: ProductType | null;
  designation: string | null;
  brandId: string | null;
  modelId: string | null;
  color: string | null;
  supplierIds: string[];
  familyId: string | null;
  subFamilyId: string | null;
  photo: string | null;

  // Pricing
  purchasePriceExclTax: number | null;
  pricingMode: PricingMode;
  coefficient: number | null;
  fixedAmount: number | null;
  fixedPrice: number | null;
  tvaRate: number | null;
  alertThreshold: number | null;

  // Frame
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
  frameFrontPhoto: string | null;
  frameSidePhoto: string | null;

  // Lens
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

  // Contact Lens
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

  // Accessory
  accessoryCategory: string | null;
  accessorySubCategory: string | null;
}

export const DEFAULT_PRODUCT_FORM: IProductForm = {
  // Common fields
  productType: null,
  designation: null,
  brandId: null,
  modelId: null,
  color: null,
  supplierIds: [],
  familyId: null,
  subFamilyId: null,
  photo: null,

  // Pricing
  purchasePriceExclTax: null,
  pricingMode: 'coefficient',
  coefficient: 2.5,
  fixedAmount: null,
  fixedPrice: null,
  tvaRate: 0.2,
  alertThreshold: 2,

  // Frame
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
  frameFrontPhoto: null,
  frameSidePhoto: null,

  // Lens
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

  // Contact Lens
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

  // Accessory
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
 * Converts a Product to IProductForm for editing.
 * @param product The product to convert
 * @returns The form data
 */
export function toProductForm(product: Product): IProductForm {
  const formData: IProductForm = {
    ...getDefaultProductForm(),
    productType: product.productType,
    designation: product.designation,
    brandId: product.brandId,
    modelId: product.modelId,
    color: product.color,
    supplierIds: product.supplierIds ?? [],
    familyId: product.familyId,
    subFamilyId: product.subFamilyId,
    photo: product.photo?.url ?? null,
    purchasePriceExclTax: product.purchasePriceExclTax,
    pricingMode: product.pricingMode,
    coefficient: product.coefficient,
    fixedAmount: product.fixedAmount,
    fixedPrice: product.fixedPrice,
    tvaRate: product.tvaRate,
    alertThreshold: product.alertThreshold,
  };

  if (product.productType === 'optical_frame' || product.productType === 'sun_frame') {
    formData.frameGender = product.gender;
    formData.frameShape = product.shape;
    formData.frameMaterial = product.material;
    formData.frameType = product.frameType;
    formData.frameHingeType = product.hingeType;
    formData.frameEyeSize = product.eyeSize;
    formData.frameBridge = product.bridge;
    formData.frameTemple = product.temple;
    formData.frameColor = product.frameColor;
    formData.frameTempleColor = product.templeColor;
    formData.frameFrontPhoto = product.frontPhoto?.url ?? null;
    formData.frameSidePhoto = product.sidePhoto?.url ?? null;
  }

  if (product.productType === 'lens') {
    formData.lensType = product.lensType;
    formData.lensMaterial = product.material;
    formData.lensRefractiveIndex = product.refractiveIndex;
    formData.lensTint = product.tint;
    formData.lensFilters = product.filters ?? [];
    formData.lensTreatments = product.treatments ?? [];
    formData.lensManufacturerId = product.manufacturerId;
    formData.lensOpticalFamily = product.opticalFamily;
    formData.lensSpherePower = product.spherePower;
    formData.lensCylinderPower = product.cylinderPower;
    formData.lensAxis = product.axis;
    formData.lensAddition = product.addition;
    formData.lensDiameter = product.diameter;
    formData.lensBaseCurve = product.baseCurve;
  }

  if (product.productType === 'contact_lens') {
    formData.contactLensType = product.contactLensType;
    formData.contactLensUsage = product.usage;
    formData.contactLensLaboratoryId = product.laboratoryId;
    formData.contactLensCommercialModel = product.commercialModel;
    formData.contactLensBaseCurve = product.baseCurve;
    formData.contactLensDiameter = product.diameter;
    formData.contactLensQuantityPerBox = product.quantityPerBox;
    formData.contactLensPricePerBox = product.pricePerBox;
    formData.contactLensPricePerUnit = product.pricePerUnit;
    formData.contactLensExpirationDate = product.expirationDate;
    formData.contactLensSpherePower = product.spherePower;
    formData.contactLensCylinder = product.cylinder;
    formData.contactLensAxis = product.axis;
    formData.contactLensAddition = product.addition;
  }

  if (product.productType === 'accessory') {
    formData.accessoryCategory = product.category;
    formData.accessorySubCategory = product.subCategory;
  }

  return formData;
}

/**
 * Returns default values for type-specific fields.
 * @returns A partial object with default values for type-specific fields
 */
export function getTypeSpecificDefaults(): Partial<IProductForm> {
  return {
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
    frameFrontPhoto: null,
    frameSidePhoto: null,
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
    accessoryCategory: null,
    accessorySubCategory: null,
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
    pricingMode: form.pricingMode,
    coefficient: form.coefficient,
    fixedAmount: form.fixedAmount,
    fixedPrice: form.fixedPrice,
    tvaRate: form.tvaRate ?? 0.2,
    purchasePriceExclTax: form.purchasePriceExclTax,
    photo: toProductPhoto(form.photo),
  };

  switch (form.productType) {
    case 'optical_frame':
    case 'sun_frame':
      return {
        ...baseRequest,
        productType: form.productType,
        category: form.productType === 'optical_frame' ? 'optical' : 'sun',
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
        frontPhoto: toProductPhoto(form.frameFrontPhoto),
        sidePhoto: toProductPhoto(form.frameSidePhoto),
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
        baseCurve: form.contactLensBaseCurve!,
        diameter: form.contactLensDiameter!,
        quantityPerBox: form.contactLensQuantityPerBox!,
        pricePerBox: form.contactLensPricePerBox!,
        pricePerUnit: form.contactLensPricePerUnit!,
        laboratoryId: form.contactLensLaboratoryId,
        commercialModel: form.contactLensCommercialModel,
        spherePower: form.contactLensSpherePower,
        cylinder: form.contactLensCylinder,
        axis: form.contactLensAxis,
        addition: form.contactLensAddition,
        batchNumber: null,
        expirationDate: form.contactLensExpirationDate,
        boxQuantity: null,
        unitQuantity: null,
      } as IContactLensCreateRequest;

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
