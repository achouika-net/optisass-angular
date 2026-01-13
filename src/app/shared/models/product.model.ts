export interface IProductPhoto {
  url: string | null;
  base64: string | null;
}

export type ProductType = 'optical_frame' | 'sun_frame' | 'lens' | 'contact_lens' | 'accessory';

export type ProductStatus =
  | 'DISPONIBLE'
  | 'RESERVE'
  | 'EN_COMMANDE'
  | 'EN_TRANSIT'
  | 'RUPTURE'
  | 'OBSOLETE';

export type PricingMode = 'coefficient' | 'fixedAmount' | 'fixedPrice';

interface IBaseProduct {
  id: string;
  internalCode: string;
  barcode: string | null;
  productType: ProductType;
  designation: string;
  brandId: string | null;
  modelId: string | null;
  color: string | null;
  supplierIds: string[];
  familyId: string | null;
  subFamilyId: string | null;
  alertThreshold: number;

  // Pricing - Mode de calcul prix de vente
  pricingMode: PricingMode;
  coefficient: number | null;
  fixedAmount: number | null;
  fixedPrice: number | null;
  tvaRate: number;

  // Champs calculés (readonly après création)
  purchasePriceExclTax: number;
  currentQuantity: number;
  status: ProductStatus;

  photo: IProductPhoto | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface IFrame extends IBaseProduct {
  productType: 'optical_frame' | 'sun_frame';
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
  productType: 'lens';
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
  productType: 'contact_lens';
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
  productType: 'accessory';
  category: string;
  subCategory: string | null;
}

export type Product = IFrame | ILens | IContactLens | IAccessory;
