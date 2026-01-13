import {
  IAccessory,
  IContactLens,
  IFrame,
  ILens,
  PaginatedApiResponse,
  Product,
} from '@app/models';
import { delay, Observable, of } from 'rxjs';
import { ProductCreateRequest, ProductUpdateRequest } from '../models';

interface SearchBody {
  search?: string;
  productTypes?: string[];
  status?: string;
  brandId?: string;
  outOfStock?: boolean;
  familyId?: string;
  subFamilyId?: string;
  modelId?: string;
  supplierId?: string;
  lowStock?: boolean;
  frame?: {
    frameShape?: string;
    frameMaterial?: string;
    frameColor?: string;
    frameGender?: string;
  };
  lens?: {
    lensIndex?: string;
    lensTreatment?: string;
    lensPhotochromic?: boolean;
  };
  contact_lens?: {
    contactLensUsage?: string;
    contactLensType?: string;
  };
  accessory?: {
    accessoryCategory?: string;
  };
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const MOCK_FRAMES: IFrame[] = [
  {
    id: '1',
    internalCode: 'MON0001',
    barcode: '2001234567890',
    productType: 'sun_frame',
    designation: 'Ray-Ban Aviator Classic',
    brandId: 'brand-1',
    modelId: '1',
    color: 'Or',
    supplierIds: ['sup-1'],
    familyId: '1',
    subFamilyId: '1',
    currentQuantity: 5,
    alertThreshold: 2,
    purchasePriceExclTax: 85,
    pricingMode: 'coefficient',
    coefficient: 2.5,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-01-15'),
    updatedAt: null,
    category: 'solaire',
    gender: 'mixte',
    shape: 'aviateur',
    material: 'metal',
    frameType: 'cerclee',
    hingeType: 'standard',
    eyeSize: 58,
    bridge: 14,
    temple: 135,
    frameColor: 'Or',
    templeColor: 'Or',
    frontPhoto: null,
    sidePhoto: null,
  },
  {
    id: '2',
    internalCode: 'MON0002',
    barcode: '2001234567891',
    productType: 'sun_frame',
    designation: 'Oakley Holbrook',
    brandId: 'OAK',
    modelId: '2',
    color: 'Noir mat',
    supplierIds: ['sup-1'],
    familyId: '2',
    subFamilyId: null,
    currentQuantity: 3,
    alertThreshold: 2,
    purchasePriceExclTax: 95,
    pricingMode: 'coefficient',
    coefficient: 2.5,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-02-10'),
    updatedAt: null,
    category: 'solaire',
    gender: 'homme',
    shape: 'rectangulaire',
    material: 'plastique',
    frameType: 'cerclee',
    hingeType: 'standard',
    eyeSize: 55,
    bridge: 18,
    temple: 137,
    frameColor: 'Noir mat',
    templeColor: 'Noir mat',
    frontPhoto: null,
    sidePhoto: null,
  },
  {
    id: '3',
    internalCode: 'MON0003',
    barcode: '2001234567892',
    productType: 'optical_frame',
    designation: 'Gucci GG0061S',
    brandId: 'brand-3',
    modelId: null,
    color: 'Écaille',
    supplierIds: ['sup-2'],
    familyId: '1',
    subFamilyId: '2',
    currentQuantity: 1,
    alertThreshold: 2,
    purchasePriceExclTax: 180,
    pricingMode: 'coefficient',
    coefficient: 2.5,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-03-05'),
    updatedAt: null,
    category: 'optique',
    gender: 'femme',
    shape: 'papillon',
    material: 'acetate',
    frameType: 'cerclee',
    hingeType: 'flex',
    eyeSize: 56,
    bridge: 17,
    temple: 140,
    frameColor: 'Écaille',
    templeColor: 'Écaille',
    frontPhoto: null,
    sidePhoto: null,
  },
];

export const MOCK_LENSES: ILens[] = [
  {
    id: '4',
    internalCode: 'VER0001',
    barcode: '2002234567890',
    productType: 'lens',
    designation: 'Essilor Varilux Comfort',
    brandId: null,
    modelId: null,
    color: null,
    supplierIds: ['sup-1', 'sup-2'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 10,
    alertThreshold: 5,
    purchasePriceExclTax: 120,
    pricingMode: 'coefficient',
    coefficient: 2.0,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-01-20'),
    updatedAt: null,
    lensType: 'progressif',
    material: 'organique',
    refractiveIndex: '1.67',
    tint: 'blanc',
    filters: ['filtre_bleu'],
    treatments: ['antireflet', 'durci', 'hydrophobe'],
    spherePower: null,
    cylinderPower: null,
    axis: null,
    addition: null,
    diameter: 70,
    baseCurve: null,
    curvature: null,
    manufacturerId: '1',
    opticalFamily: null,
  },
  {
    id: '5',
    internalCode: 'VER0002',
    barcode: '2002234567891',
    productType: 'lens',
    designation: 'Zeiss Single Vision 1.6',
    brandId: null,
    modelId: null,
    color: null,
    supplierIds: ['sup-2'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 15,
    alertThreshold: 5,
    purchasePriceExclTax: 75,
    pricingMode: 'coefficient',
    coefficient: 2.0,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-02-15'),
    updatedAt: null,
    lensType: 'unifocal',
    material: 'organique',
    refractiveIndex: '1.6',
    tint: 'blanc',
    filters: [],
    treatments: ['antireflet', 'durci'],
    spherePower: null,
    cylinderPower: null,
    axis: null,
    addition: null,
    diameter: 65,
    baseCurve: null,
    curvature: null,
    manufacturerId: '2',
    opticalFamily: null,
  },
];

export const MOCK_CONTACT_LENSES: IContactLens[] = [
  {
    id: '6',
    internalCode: 'LEN0001',
    barcode: '2003234567890',
    productType: 'contact_lens',
    designation: 'Acuvue Oasys 1-Day',
    brandId: null,
    modelId: null,
    color: null,
    supplierIds: ['sup-3'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 20,
    alertThreshold: 10,
    purchasePriceExclTax: 35,
    pricingMode: 'coefficient',
    coefficient: 1.8,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-01-10'),
    updatedAt: null,
    contactLensType: 'journaliere',
    usage: 'myopie',
    laboratoryId: '4',
    commercialModel: 'Oasys 1-Day',
    spherePower: -3.0,
    cylinder: null,
    axis: null,
    addition: null,
    baseCurve: 8.5,
    diameter: 14.3,
    quantityPerBox: 90,
    pricePerBox: 63,
    pricePerUnit: 0.7,
    batchNumber: 'LOT2024A',
    expirationDate: new Date('2026-06-30'),
    boxQuantity: 20,
    unitQuantity: null,
  },
  {
    id: '7',
    internalCode: 'LEN0002',
    barcode: '2003234567891',
    productType: 'contact_lens',
    designation: 'Air Optix Aqua Multifocal',
    brandId: null,
    modelId: null,
    color: null,
    supplierIds: ['sup-3'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 8,
    alertThreshold: 5,
    purchasePriceExclTax: 28,
    pricingMode: 'coefficient',
    coefficient: 1.8,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-02-20'),
    updatedAt: null,
    contactLensType: 'mensuelle',
    usage: 'presbytie',
    laboratoryId: '2',
    commercialModel: 'Air Optix Aqua',
    spherePower: -2.5,
    cylinder: null,
    axis: null,
    addition: 2.0,
    baseCurve: 8.6,
    diameter: 14.2,
    quantityPerBox: 6,
    pricePerBox: 50.4,
    pricePerUnit: 8.4,
    batchNumber: 'LOT2024B',
    expirationDate: new Date('2025-03-15'),
    boxQuantity: 8,
    unitQuantity: null,
  },
];

export const MOCK_ACCESSORIES: IAccessory[] = [
  {
    id: '8',
    internalCode: 'ACC0001',
    barcode: '2004234567890',
    productType: 'accessory',
    designation: 'Étui rigide noir',
    brandId: null,
    modelId: null,
    color: 'Noir',
    supplierIds: ['sup-1'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 50,
    alertThreshold: 20,
    purchasePriceExclTax: 3.5,
    pricingMode: 'coefficient',
    coefficient: 3.0,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-01-05'),
    updatedAt: null,
    category: 'etui',
    subCategory: null,
  },
  {
    id: '9',
    internalCode: 'ACC0002',
    barcode: '2004234567891',
    productType: 'accessory',
    designation: 'Chiffon microfibre',
    brandId: null,
    modelId: null,
    color: null,
    supplierIds: ['sup-1'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 100,
    alertThreshold: 30,
    purchasePriceExclTax: 0.5,
    pricingMode: 'coefficient',
    coefficient: 4.0,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'DISPONIBLE',
    createdAt: new Date('2024-01-05'),
    updatedAt: null,
    category: 'chiffon',
    subCategory: null,
  },
  {
    id: '10',
    internalCode: 'ACC0003',
    barcode: '2004234567892',
    productType: 'accessory',
    designation: 'Spray nettoyant 30ml',
    brandId: null,
    modelId: null,
    color: null,
    supplierIds: ['sup-1', 'sup-2'],
    familyId: null,
    subFamilyId: null,
    currentQuantity: 0,
    alertThreshold: 20,
    purchasePriceExclTax: 1.2,
    pricingMode: 'coefficient',
    coefficient: 3.5,
    fixedAmount: null,
    fixedPrice: null,
    tvaRate: 0.2,
    photo: null,
    status: 'RUPTURE',
    createdAt: new Date('2024-01-05'),
    updatedAt: null,
    category: 'entretien',
    subCategory: null,
  },
];

const mockProducts: Product[] = [
  ...MOCK_FRAMES,
  ...MOCK_LENSES,
  ...MOCK_CONTACT_LENSES,
  ...MOCK_ACCESSORIES,
];
let nextId = 11;

/**
 * Génère un code interne basé sur le type de produit.
 */
function generateInternalCode(productType: string): string {
  const prefixes: Record<string, string> = {
    optical_frame: 'MON',
    sun_frame: 'MON',
    lens: 'VER',
    contact_lens: 'LEN',
    accessory: 'ACC',
  };
  const prefix = prefixes[productType] || 'PRD';
  const number = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}${number}`;
}

/**
 * Génère un code-barres EAN-13.
 */
function generateBarcode(): string {
  const prefix = '200';
  const random = String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
  const code = prefix + random;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code + checksum;
}

/**
 * Recherche des produits avec filtrage, tri et pagination.
 * @param body Objet contenant les filtres, pagination et tri
 * @returns Observable de la réponse paginée
 */
export function mockSearchProducts(body: SearchBody): Observable<PaginatedApiResponse<Product>> {
  const page = body.page ?? 1;
  const pageSize = body.pageSize ?? 10;
  const sortBy = body.sort;
  const sortOrder = body.order;

  const search = body.search;
  const productTypes = body.productTypes ?? [];
  const status = body.status;
  const brandId = body.brandId;
  const outOfStock = body.outOfStock;
  const familyId = body.familyId;
  const subFamilyId = body.subFamilyId;
  const modelId = body.modelId;
  const supplierId = body.supplierId;
  const lowStock = body.lowStock;
  const frameShape = body.frame?.frameShape;
  const frameMaterial = body.frame?.frameMaterial;
  const frameColor = body.frame?.frameColor;
  const frameGender = body.frame?.frameGender;
  const lensIndex = body.lens?.lensIndex;
  const lensTreatment = body.lens?.lensTreatment;
  const contactLensUsage = body.contact_lens?.contactLensUsage;
  const contactLensType = body.contact_lens?.contactLensType;
  const accessoryCategory = body.accessory?.accessoryCategory;

  let filtered = mockProducts.filter((p) => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !p.designation.toLowerCase().includes(searchLower) &&
        !p.internalCode.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    if (productTypes.length > 0 && !productTypes.includes(p.productType)) return false;
    if (status && p.status !== status) return false;
    if (brandId && p.brandId !== brandId) return false;
    if (outOfStock === true && p.currentQuantity !== 0) return false;
    if (outOfStock === false && p.currentQuantity === 0) return false;

    if (familyId && p.familyId !== familyId) return false;
    if (subFamilyId && p.subFamilyId !== subFamilyId) return false;
    if (modelId && p.modelId !== modelId) return false;
    if (supplierId && !p.supplierIds.includes(supplierId)) return false;
    if (lowStock === true && p.currentQuantity > p.alertThreshold) return false;
    if (lowStock === false && p.currentQuantity <= p.alertThreshold) return false;

    const isFrame = p.productType === 'optical_frame' || p.productType === 'sun_frame';
    if (frameShape && isFrame) {
      if ((p as unknown as { shape?: string }).shape !== frameShape) return false;
    }
    if (frameMaterial && isFrame) {
      if ((p as unknown as { material?: string }).material !== frameMaterial) return false;
    }
    if (frameColor && isFrame) {
      if ((p as unknown as { frameColor?: string }).frameColor !== frameColor) return false;
    }
    if (frameGender && isFrame) {
      if ((p as unknown as { gender?: string }).gender !== frameGender) return false;
    }

    if (lensIndex && p.productType === 'lens') {
      if ((p as unknown as { refractiveIndex?: string }).refractiveIndex !== lensIndex)
        return false;
    }
    if (lensTreatment && p.productType === 'lens') {
      const treatments = (p as unknown as { treatments?: string[] }).treatments ?? [];
      if (!treatments.includes(lensTreatment)) return false;
    }

    if (contactLensUsage && p.productType === 'contact_lens') {
      if ((p as unknown as { usage?: string }).usage !== contactLensUsage) return false;
    }
    if (contactLensType && p.productType === 'contact_lens') {
      if ((p as unknown as { contactLensType?: string }).contactLensType !== contactLensType)
        return false;
    }

    if (accessoryCategory && p.productType === 'accessory') {
      if ((p as unknown as { category?: string }).category !== accessoryCategory) return false;
    }

    return true;
  });

  if (sortBy && sortOrder) {
    filtered = [...filtered].sort((a, b) => {
      const aValue = (a as unknown as Record<string, unknown>)[sortBy];
      const bValue = (b as unknown as Record<string, unknown>)[sortBy];
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paginatedData = filtered.slice(start, start + pageSize);

  return of({
    data: paginatedData,
    meta: {
      current_page: page,
      from: start + 1,
      last_page: Math.ceil(total / pageSize),
      path: '/api/products',
      per_page: pageSize,
      to: Math.min(start + pageSize, total),
      total,
    },
    links: { first: '', last: '', prev: null, next: null },
  }).pipe(delay(200));
}

/**
 * Récupère un produit par son ID.
 */
export function mockGetProduct(id: string): Observable<Product> {
  const product = mockProducts.find((p) => p.id === id);
  return of(product!).pipe(delay(100));
}

/**
 * Crée un nouveau produit.
 */
export function mockCreateProduct(request: ProductCreateRequest): Observable<Product> {
  const newProduct = {
    ...request,
    id: String(nextId++),
    internalCode: generateInternalCode(request.productType),
    barcode: generateBarcode(),
    currentQuantity: 0,
    status: 'DISPONIBLE' as const,
    createdAt: new Date(),
    updatedAt: null,
  } as Product;

  mockProducts.push(newProduct);
  return of(newProduct).pipe(delay(200));
}

/**
 * Met à jour un produit existant.
 */
export function mockUpdateProduct(id: string, request: ProductUpdateRequest): Observable<Product> {
  const index = mockProducts.findIndex((p) => p.id === id);
  if (index !== -1) {
    const updated = {
      ...mockProducts[index],
      ...request,
      updatedAt: new Date(),
    } as Product;
    mockProducts[index] = updated;
    return of(updated).pipe(delay(200));
  }
  return of(null as unknown as Product);
}

/**
 * Supprime un produit.
 */
export function mockDeleteProduct(id: string): Observable<void> {
  const index = mockProducts.findIndex((p) => p.id === id);
  if (index !== -1) {
    mockProducts.splice(index, 1);
  }
  return of(void 0).pipe(delay(200));
}
