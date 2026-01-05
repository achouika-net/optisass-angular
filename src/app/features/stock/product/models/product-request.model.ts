import { IProductPhoto, ProductType } from '@app/models';

interface IBaseProductRequest {
  designation: string;
  brandId: string | null;
  modelId: string | null;
  color: string | null;
  supplierReference: string | null;
  familyId: string | null;
  subFamilyId: string | null;
  mainSupplier: string | null;
  currentQuantity: number;
  alertThreshold: number;
  purchasePriceExclTax: number;
  coefficient: number;
  tvaRate: number;
  photo: IProductPhoto | null;
  warehouseId: string;
}

export interface IFrameCreateRequest extends IBaseProductRequest {
  productType: 'monture';
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
  productType: 'verre';
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
  productType: 'lentille';
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
  productType: 'accessoire';
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
