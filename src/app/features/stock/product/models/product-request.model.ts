import { IProductPhoto, PricingMode, ProductType } from '@app/models';

interface IBaseProductRequest {
  designation: string | null;
  brandId: string | null;
  modelId: string | null;
  color: string | null;
  supplierIds: string[];
  familyId: string | null;
  subFamilyId: string | null;
  alertThreshold: number;

  // Pricing
  pricingMode: PricingMode;
  coefficient: number | null;
  fixedAmount: number | null;
  fixedPrice: number | null;
  tvaRate: number;

  // Prix d'achat : saisie uniquement en création
  purchasePriceExclTax: number | null;

  photo: IProductPhoto | null;
}

export interface IFrameCreateRequest extends IBaseProductRequest {
  productType: 'optical_frame' | 'sun_frame';
  category: string;
  shape: string;
  material: string;
  eyeSize: number;
  bridge: number;
  temple: number;
  frameType: string;
  gender: string | null;
  hingeType: string | null;
  frameColor: string | null;
  templeColor: string | null;
  frontPhoto: IProductPhoto | null;
  sidePhoto: IProductPhoto | null;
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
  usage: string;
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

export interface IAccessoryCreateRequest extends IBaseProductRequest {
  productType: 'accessory';
  category: string;
  subCategory: string | null;
}

export type ProductCreateRequest =
  | IFrameCreateRequest
  | ILensCreateRequest
  | IContactLensCreateRequest
  | IAccessoryCreateRequest;

export type ProductUpdateRequest = Partial<ProductCreateRequest> & {
  id: string;
  productType: ProductType;
};
