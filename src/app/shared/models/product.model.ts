export interface IProductPhoto {
  url: string | null;
  base64: string | null;
}

export type ProductType = 'monture' | 'verre' | 'lentille' | 'accessoire';

export type ProductStatus =
  | 'DISPONIBLE'
  | 'RESERVE'
  | 'EN_COMMANDE'
  | 'EN_TRANSIT'
  | 'RUPTURE'
  | 'OBSOLETE';

interface IBaseProduct {
  id: string;
  internalCode: string;
  barcode: string | null;
  productType: ProductType;
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
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface IFrame extends IBaseProduct {
  productType: 'monture';
  category: string;
  gender: string | null;
  shape: string;
  material: string;
  frameType: string;
  hingeType: string | null;
  eyeSize: number;
  bridge: number;
  temple: number;
  frameColor: string | null;
  templeColor: string | null;
  frontPhoto: IProductPhoto | null;
  sidePhoto: IProductPhoto | null;
}

export interface ILens extends IBaseProduct {
  productType: 'verre';
  lensType: string;
  material: string;
  refractiveIndex: string | null;
  tint: string | null;
  filters: string[];
  treatments: string[];
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

export interface IContactLens extends IBaseProduct {
  productType: 'lentille';
  contactLensType: string;
  usage: string;
  laboratoryId: string | null;
  commercialModel: string | null;
  spherePower: number | null;
  cylinder: number | null;
  axis: number | null;
  addition: number | null;
  baseCurve: number;
  diameter: number;
  quantityPerBox: number;
  pricePerBox: number;
  pricePerUnit: number;
  batchNumber: string | null;
  expirationDate: Date | null;
  boxQuantity: number | null;
  unitQuantity: number | null;
}

export interface IAccessory extends IBaseProduct {
  productType: 'accessoire';
  category: string;
  subCategory: string | null;
}

export type Product = IFrame | ILens | IContactLens | IAccessory;
