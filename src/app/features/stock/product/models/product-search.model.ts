import { ProductStatus, ProductType } from '@app/models';

export interface IProductSearch {
  search: string | null;
  warehouseId: string | null;
  productTypes: ProductType[];
  status: ProductStatus | null;
  brandId: string | null;
  outOfStock: boolean | null;
  familyId: string | null;
  subFamilyId: string | null;
  modelId: string | null;
  supplierId: string | null;
  lowStock: boolean | null;
  expirationSoon: boolean | null;
  frameShape: string | null;
  frameMaterial: string | null;
  frameColor: string | null;
  frameGender: string | null;
  lensIndex: string | null;
  lensTreatment: string | null;
  lensPhotochromic: boolean | null;
  contactLensUsage: string | null;
  contactLensType: string | null;
  accessoryCategory: string | null;
}

export class ProductSearch implements IProductSearch {
  search: string | null = null;
  warehouseId: string | null = null;
  productTypes: ProductType[] = [];
  status: ProductStatus | null = null;
  brandId: string | null = null;
  outOfStock: boolean | null = null;
  familyId: string | null = null;
  subFamilyId: string | null = null;
  modelId: string | null = null;
  supplierId: string | null = null;
  lowStock: boolean | null = null;
  expirationSoon: boolean | null = null;
  frameShape: string | null = null;
  frameMaterial: string | null = null;
  frameColor: string | null = null;
  frameGender: string | null = null;
  lensIndex: string | null = null;
  lensTreatment: string | null = null;
  lensPhotochromic: boolean | null = null;
  contactLensUsage: string | null = null;
  contactLensType: string | null = null;
  accessoryCategory: string | null = null;
}

/**
 * Transforme les filtres de recherche en structure imbriquée par type de produit.
 * @param search Les filtres de recherche à plat
 * @returns Objet avec les filtres regroupés par type de produit
 */
export function toNestedProductSearch(search: IProductSearch): object {
  return {
    search: search.search,
    warehouseId: search.warehouseId,
    productTypes: search.productTypes,
    status: search.status,
    brandId: search.brandId,
    outOfStock: search.outOfStock,
    familyId: search.familyId,
    subFamilyId: search.subFamilyId,
    modelId: search.modelId,
    supplierId: search.supplierId,
    lowStock: search.lowStock,
    expirationSoon: search.expirationSoon,
    monture: {
      frameShape: search.frameShape,
      frameMaterial: search.frameMaterial,
      frameColor: search.frameColor,
      frameGender: search.frameGender,
    },
    verre: {
      lensIndex: search.lensIndex,
      lensTreatment: search.lensTreatment,
      lensPhotochromic: search.lensPhotochromic,
    },
    lentille: {
      contactLensUsage: search.contactLensUsage,
      contactLensType: search.contactLensType,
    },
    accessoire: {
      accessoryCategory: search.accessoryCategory,
    },
  };
}
