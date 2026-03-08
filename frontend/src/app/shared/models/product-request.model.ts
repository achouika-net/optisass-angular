import {
  IProductPhoto,
  ISupplierProductCode,
  PricingMode,
  ProductType,
} from '@optisaas/opti-saas-lib';
import { FrameSubType } from './index';

interface IBaseProductRequest {
  designation: string | null;
  brandId: string | null;
  modelId: string | null;
  color: string | null;
  supplierIds: string[];
  familyId: string | null;
  subFamilyId: string | null;
  alertThreshold: number;

  // Codes produits pour matching OCR
  manufacturerRef: string | null;
  supplierCodes: readonly ISupplierProductCode[];

  // Pricing
  pricingMode: PricingMode;
  coefficient: number | null;
  fixedAmount: number | null;
  fixedPrice: number | null;
  tvaRate: number;

  // Purchase price: input only on creation
  purchasePriceExclTax: number | null;

  photo: IProductPhoto | null;
}

export interface IFrameCreateRequest extends IBaseProductRequest {
  productType: 'frame';
  frameSubType: FrameSubType;
  shape: string | null;
  material: string | null;
  eyeSize: number | null;
  bridge: number | null;
  temple: number | null;
  frameType: string | null;
  gender: string | null;
  hingeType: string | null;
  frameColor: string | null;
  templeColor: string | null;
  frameFinish: string | null;
  frontPhoto: IProductPhoto | null;
  sidePhoto: IProductPhoto | null;
  safetyStandard: string | null;
  safetyRating: string | null;
  protectionType: string | null;
  lensIncluded: boolean;
  prescriptionCapable: boolean;
}

export interface ILensCreateRequest extends IBaseProductRequest {
  productType: 'lens';
  lensType: string;
  material: string;
  refractiveIndex: string | null;
  tint: string | null;
  filters: string[] | null;
  treatments: string[] | null;
  spherePower: number | null;
  cylinderPower: number | null;
  axis: number | null;
  addition: number | null;
  diameter: number | null;
  baseCurve: number | null;
  curvature: number | null;
  manufacturerId: string | null;
  opticalFamily: string | null;
}

export interface IContactLensCreateRequest extends IBaseProductRequest {
  productType: 'contact_lens';
  contactLensType: string;
  usage: string | null;
  baseCurve: number;
  diameter: number;
  quantityPerBox: number;
  pricePerBox: number;
  pricePerUnit: number;
  laboratoryId: string | null;
  commercialModel: string | null;
  spherePower: number | null;
  cylinder: number | null;
  axis: number | null;
  addition: number | null;
  batchNumber: string | null;
  expirationDate: Date | null;
  boxQuantity: number | null;
  unitQuantity: number | null;
}

export interface IClipOnCreateRequest extends IBaseProductRequest {
  productType: 'clip_on';
  clipType: string;
  polarized: boolean;
  mirrorCoating: boolean;
  tint: string | null;
  compatibleFrameSize: string | null;
}

export interface IAccessoryCreateRequest extends IBaseProductRequest {
  productType: 'accessory';
  category: string;
  subCategory: string | null;
}

export type ProductCreateRequest =
  | IFrameCreateRequest
  | ILensCreateRequest
  | IContactLensCreateRequest
  | IClipOnCreateRequest
  | IAccessoryCreateRequest;

export type ProductUpdateRequest = Partial<ProductCreateRequest> & {
  id: string;
  productType: ProductType;
};
