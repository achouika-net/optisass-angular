import { IWarehouse } from '../../features/settings/warehouse/models/warehouse.model';
import {
  IBrand,
  IColor,
  IFamily,
  ILaboratory,
  IManufacturer,
  IModel,
  IResource,
  ResourceMap,
  ResourceType,
  ISubFamily,
  ISupplier,
} from '@app/models';

// ============================================
// Resources simples (type Resource)
// ============================================

const MOCK_PRODUCT_TYPES: IResource[] = [
  { id: 'pt-1', code: 'optical_frame', label: 'stock.productTypes.optical_frame', order: 1 },
  { id: 'pt-2', code: 'sun_frame', label: 'stock.productTypes.sun_frame', order: 2 },
  { id: 'pt-3', code: 'lens', label: 'stock.productTypes.lens', order: 3 },
  { id: 'pt-4', code: 'contact_lens', label: 'stock.productTypes.contact_lens', order: 4 },
  { id: 'pt-5', code: 'accessory', label: 'stock.productTypes.accessory', order: 5 },
];

const MOCK_PRODUCT_STATUSES: IResource[] = [
  { id: 'ps-1', code: 'DISPONIBLE', label: 'Disponible', order: 1 },
  { id: 'ps-2', code: 'RESERVE', label: 'Réservé', order: 2 },
  { id: 'ps-3', code: 'EN_COMMANDE', label: 'En commande', order: 3 },
  { id: 'ps-4', code: 'EN_TRANSIT', label: 'En transit', order: 4 },
  { id: 'ps-5', code: 'RUPTURE', label: 'Rupture', order: 5 },
  { id: 'ps-6', code: 'OBSOLETE', label: 'Obsolète', order: 6 },
];

const MOCK_FRAME_CATEGORIES: IResource[] = [
  { id: 'fc-1', code: 'optique', label: 'Optique', order: 1 },
  { id: 'fc-2', code: 'solaire', label: 'Solaire', order: 2 },
];

const MOCK_GENDERS: IResource[] = [
  { id: 'gen-1', code: 'homme', label: 'Homme', order: 1 },
  { id: 'gen-2', code: 'femme', label: 'Femme', order: 2 },
  { id: 'gen-3', code: 'enfant', label: 'Enfant', order: 3 },
  { id: 'gen-4', code: 'mixte', label: 'Mixte', order: 4 },
];

const MOCK_FRAME_SHAPES: IResource[] = [
  { id: 'fs-1', code: 'ronde', label: 'Ronde', order: 1 },
  { id: 'fs-2', code: 'carree', label: 'Carrée', order: 2 },
  { id: 'fs-3', code: 'rectangulaire', label: 'Rectangulaire', order: 3 },
  { id: 'fs-4', code: 'papillon', label: 'Papillon', order: 4 },
  { id: 'fs-5', code: 'aviateur', label: 'Aviateur', order: 5 },
  { id: 'fs-6', code: 'ovale', label: 'Ovale', order: 6 },
  { id: 'fs-7', code: 'autre', label: 'Autre', order: 7 },
];

const MOCK_FRAME_MATERIALS: IResource[] = [
  { id: 'fm-1', code: 'acetate', label: 'Acétate', order: 1 },
  { id: 'fm-2', code: 'metal', label: 'Métal', order: 2 },
  { id: 'fm-3', code: 'titane', label: 'Titane', order: 3 },
  { id: 'fm-4', code: 'mixte', label: 'Mixte', order: 4 },
  { id: 'fm-5', code: 'plastique', label: 'Plastique', order: 5 },
  { id: 'fm-6', code: 'autre', label: 'Autre', order: 6 },
];

const MOCK_FRAME_TYPES: IResource[] = [
  { id: 'ft-1', code: 'cerclee', label: 'Cerclée', order: 1 },
  { id: 'ft-2', code: 'nylor', label: 'Nylor', order: 2 },
  { id: 'ft-3', code: 'percee', label: 'Percée', order: 3 },
];

const MOCK_HINGE_TYPES: IResource[] = [
  { id: 'ht-1', code: 'standard', label: 'Standard', order: 1 },
  { id: 'ht-2', code: 'flex', label: 'Flex', order: 2 },
  { id: 'ht-3', code: 'ressort', label: 'Ressort', order: 3 },
];

const MOCK_LENS_TYPES: IResource[] = [
  { id: 'lt-1', code: 'unifocal', label: 'Unifocal', order: 1 },
  { id: 'lt-2', code: 'progressif', label: 'Progressif', order: 2 },
  { id: 'lt-3', code: 'degressif', label: 'Dégressif', order: 3 },
  { id: 'lt-4', code: 'bifocal', label: 'Bifocal', order: 4 },
  { id: 'lt-5', code: 'trifocal', label: 'Trifocal', order: 5 },
  { id: 'lt-6', code: 'mi_distance', label: 'Mi-distance', order: 6 },
  { id: 'lt-7', code: 'bureau', label: 'Bureau', order: 7 },
  { id: 'lt-8', code: 'sport', label: 'Sport', order: 8 },
];

const MOCK_LENS_MATERIALS: IResource[] = [
  { id: 'lm-1', code: 'organique', label: 'Organique', order: 1 },
  { id: 'lm-2', code: 'polycarbonate', label: 'Polycarbonate', order: 2 },
  { id: 'lm-3', code: 'mineral', label: 'Minéral', order: 3 },
  { id: 'lm-4', code: 'trivex', label: 'Trivex', order: 4 },
  { id: 'lm-5', code: 'haut_indice', label: 'Haut indice', order: 5 },
  { id: 'lm-6', code: 'cr39', label: 'CR-39', order: 6 },
];

const MOCK_LENS_TINTS: IResource[] = [
  { id: 'lti-1', code: 'blanc', label: 'Blanc', order: 1 },
  { id: 'lti-2', code: 'photochromique', label: 'Photochromique', order: 2 },
  { id: 'lti-3', code: 'solaire', label: 'Solaire', order: 3 },
  { id: 'lti-4', code: 'polarisant', label: 'Polarisant', order: 4 },
  { id: 'lti-5', code: 'autre', label: 'Autre', order: 5 },
];

const MOCK_LENS_FILTERS: IResource[] = [
  { id: 'lf-1', code: 'filtre_bleu', label: 'Filtre lumière bleue', order: 1 },
  { id: 'lf-2', code: 'uv', label: 'UV', order: 2 },
];

const MOCK_LENS_TREATMENTS: IResource[] = [
  { id: 'ltr-1', code: 'antireflet', label: 'Antireflet', order: 1 },
  { id: 'ltr-2', code: 'durci', label: 'Durci', order: 2 },
  { id: 'ltr-3', code: 'hydrophobe', label: 'Hydrophobe', order: 3 },
  { id: 'ltr-4', code: 'oleophobe', label: 'Oléophobe', order: 4 },
  { id: 'ltr-5', code: 'uv', label: 'UV', order: 5 },
  { id: 'ltr-6', code: 'anti_rayure', label: 'Anti-rayure', order: 6 },
  { id: 'ltr-7', code: 'filtre_lumiere_bleue', label: 'Filtre lumière bleue', order: 7 },
  { id: 'ltr-8', code: 'anti_buee', label: 'Anti-buée', order: 8 },
  { id: 'ltr-9', code: 'anti_salissure', label: 'Anti-salissure', order: 9 },
  { id: 'ltr-10', code: 'super_hydrophobe', label: 'Super hydrophobe', order: 10 },
];

const MOCK_LENS_INDICES: IResource[] = [
  { id: 'li-1', code: '1.5', label: '1.5', order: 1 },
  { id: 'li-2', code: '1.53', label: '1.53', order: 2 },
  { id: 'li-3', code: '1.56', label: '1.56', order: 3 },
  { id: 'li-4', code: '1.59', label: '1.59', order: 4 },
  { id: 'li-5', code: '1.6', label: '1.6', order: 5 },
  { id: 'li-6', code: '1.67', label: '1.67', order: 6 },
  { id: 'li-7', code: '1.74', label: '1.74', order: 7 },
];

const MOCK_CONTACT_LENS_TYPES: IResource[] = [
  { id: 'clt-1', code: 'journaliere', label: 'Journalière', order: 1 },
  { id: 'clt-2', code: 'bimensuelle', label: 'Bimensuelle', order: 2 },
  { id: 'clt-3', code: 'mensuelle', label: 'Mensuelle', order: 3 },
  { id: 'clt-4', code: 'annuelle', label: 'Annuelle', order: 4 },
];

const MOCK_CONTACT_LENS_USAGES: IResource[] = [
  { id: 'clu-1', code: 'myopie', label: 'Myopie', order: 1 },
  { id: 'clu-2', code: 'hypermetropie', label: 'Hypermétropie', order: 2 },
  { id: 'clu-3', code: 'astigmatisme', label: 'Astigmatisme', order: 3 },
  { id: 'clu-4', code: 'presbytie', label: 'Presbytie', order: 4 },
  { id: 'clu-5', code: 'cosmetique', label: 'Cosmétique', order: 5 },
];

const MOCK_ACCESSORY_CATEGORIES: IResource[] = [
  { id: 'ac-1', code: 'etui', label: 'Étui', order: 1 },
  { id: 'ac-2', code: 'chiffon', label: 'Chiffon', order: 2 },
  { id: 'ac-3', code: 'cordon', label: 'Cordon', order: 3 },
  { id: 'ac-4', code: 'visserie', label: 'Visserie', order: 4 },
  { id: 'ac-5', code: 'entretien', label: 'Entretien', order: 5 },
  { id: 'ac-6', code: 'presentation', label: 'Présentation', order: 6 },
  { id: 'ac-7', code: 'autre', label: 'Autre', order: 7 },
];

const MOCK_CIVILITES: IResource[] = [
  { id: 'civ-1', code: 'M', label: 'Monsieur', order: 1 },
  { id: 'civ-2', code: 'Mme', label: 'Madame', order: 2 },
  { id: 'civ-3', code: 'Mlle', label: 'Mademoiselle', order: 3 },
  { id: 'civ-4', code: 'Dr', label: 'Docteur', order: 4 },
  { id: 'civ-5', code: 'Pr', label: 'Professeur', order: 5 },
];

const MOCK_TVA_RATES: IResource[] = [
  { id: 'tva-1', code: '0', label: '0%', order: 1 },
  { id: 'tva-2', code: '0.07', label: '7%', order: 2 },
  { id: 'tva-3', code: '0.10', label: '10%', order: 3 },
  { id: 'tva-4', code: '0.14', label: '14%', order: 4 },
  { id: 'tva-5', code: '0.20', label: '20%', order: 5 },
];

const MOCK_PRICING_MODES: IResource[] = [
  { id: 'pm-1', code: 'coefficient', label: 'stock.pricingModes.coefficient', order: 1 },
  { id: 'pm-2', code: 'fixedAmount', label: 'stock.pricingModes.fixedAmount', order: 2 },
  { id: 'pm-3', code: 'fixedPrice', label: 'stock.pricingModes.fixedPrice', order: 3 },
];

export const MOCK_RESOURCES: ResourceMap = {
  productTypes: MOCK_PRODUCT_TYPES,
  productStatuses: MOCK_PRODUCT_STATUSES,
  frameCategories: MOCK_FRAME_CATEGORIES,
  genders: MOCK_GENDERS,
  frameShapes: MOCK_FRAME_SHAPES,
  frameMaterials: MOCK_FRAME_MATERIALS,
  frameTypes: MOCK_FRAME_TYPES,
  hingeTypes: MOCK_HINGE_TYPES,
  lensTypes: MOCK_LENS_TYPES,
  lensMaterials: MOCK_LENS_MATERIALS,
  lensTints: MOCK_LENS_TINTS,
  lensFilters: MOCK_LENS_FILTERS,
  lensTreatments: MOCK_LENS_TREATMENTS,
  lensIndices: MOCK_LENS_INDICES,
  contactLensTypes: MOCK_CONTACT_LENS_TYPES,
  contactLensUsages: MOCK_CONTACT_LENS_USAGES,
  accessoryCategories: MOCK_ACCESSORY_CATEGORIES,
  civilites: MOCK_CIVILITES,
  tvaRates: MOCK_TVA_RATES,
  pricingModes: MOCK_PRICING_MODES,
};

/**
 * Returns mock resources by type.
 * @param {ResourceType} type - The resource type to retrieve
 * @returns {IResource[]} Array of resources for the given type
 */
export function getMockResourcesByType(type: ResourceType): IResource[] {
  return MOCK_RESOURCES[type];
}

// ============================================
// Resources spécifiques (types différents)
// ============================================

export const MOCK_BRANDS: IBrand[] = [
  {
    id: 'brand-1',
    code: 'RAY',
    label: 'Ray-Ban',
    logo: null,
    country: 'Italie',
    order: 1,
    active: true,
  },
  {
    id: 'brand-2',
    code: 'OAK',
    label: 'Oakley',
    logo: null,
    country: 'USA',
    order: 2,
    active: true,
  },
  {
    id: 'brand-3',
    code: 'GUC',
    label: 'Gucci',
    logo: null,
    country: 'Italie',
    order: 3,
    active: true,
  },
  {
    id: 'brand-4',
    code: 'PRA',
    label: 'Prada',
    logo: null,
    country: 'Italie',
    order: 4,
    active: true,
  },
  {
    id: 'brand-5',
    code: 'TFO',
    label: 'Tom Ford',
    logo: null,
    country: 'Italie',
    order: 5,
    active: true,
  },
  {
    id: 'brand-6',
    code: 'CAR',
    label: 'Carrera',
    logo: null,
    country: 'Italie',
    order: 6,
    active: true,
  },
  {
    id: 'brand-7',
    code: 'POL',
    label: 'Polaroid',
    logo: null,
    country: 'Pays-Bas',
    order: 7,
    active: true,
  },
];

export const MOCK_MODELS: IModel[] = [
  { id: 'model-1', code: 'AVI', label: 'Aviator', brandId: 'RAY', order: 1, active: true },
  { id: 'model-2', code: 'WAY', label: 'Wayfarer', brandId: 'RAY', order: 2, active: true },
  { id: 'model-3', code: 'CLU', label: 'Clubmaster', brandId: 'RAY', order: 3, active: true },
  { id: 'model-4', code: 'HOL', label: 'Holbrook', brandId: 'OAK', order: 1, active: true },
  { id: 'model-5', code: 'FRO', label: 'Frogskins', brandId: 'OAK', order: 2, active: true },
  { id: 'model-6', code: 'GG0', label: 'GG0061S', brandId: 'GUC', order: 1, active: true },
  { id: 'model-7', code: 'PR0', label: 'PR 01OS', brandId: 'PRA', order: 1, active: true },
  { id: 'model-8', code: 'TF5', label: 'TF5178', brandId: 'TFO', order: 1, active: true },
];

export const MOCK_MANUFACTURERS: IManufacturer[] = [
  {
    id: 'manuf-1',
    code: 'ESS',
    label: 'Essilor',
    country: 'France',
    contact: 'contact@essilor.fr',
    order: 1,
    active: true,
  },
  {
    id: 'manuf-2',
    code: 'ZEI',
    label: 'Zeiss',
    country: 'Allemagne',
    contact: 'contact@zeiss.de',
    order: 2,
    active: true,
  },
  {
    id: 'manuf-3',
    code: 'HOY',
    label: 'Hoya',
    country: 'Japon',
    contact: 'contact@hoya.jp',
    order: 3,
    active: true,
  },
  {
    id: 'manuf-4',
    code: 'ROD',
    label: 'Rodenstock',
    country: 'Allemagne',
    contact: 'contact@rodenstock.de',
    order: 4,
    active: true,
  },
  {
    id: 'manuf-5',
    code: 'NIK',
    label: 'Nikon',
    country: 'Japon',
    contact: 'contact@nikon.jp',
    order: 5,
    active: true,
  },
];

export const MOCK_LABORATORIES: ILaboratory[] = [
  { id: 'lab-1', code: 'ACU', label: 'Acuvue', country: 'USA', order: 1, active: true },
  { id: 'lab-2', code: 'BAU', label: 'Bausch & Lomb', country: 'USA', order: 2, active: true },
  { id: 'lab-3', code: 'COO', label: 'CooperVision', country: 'USA', order: 3, active: true },
  { id: 'lab-4', code: 'ALC', label: 'Alcon', country: 'Suisse', order: 4, active: true },
  { id: 'lab-5', code: 'MEN', label: 'Menicon', country: 'Japon', order: 5, active: true },
];

export const MOCK_FAMILIES: IFamily[] = [
  { id: 'fam-1', code: 'OPT', label: 'Optique', order: 1, active: true },
  { id: 'fam-2', code: 'SOL', label: 'Solaire', order: 2, active: true },
  { id: 'fam-3', code: 'SPO', label: 'Sport', order: 3, active: true },
  { id: 'fam-4', code: 'ENF', label: 'Enfant', order: 4, active: true },
  { id: 'fam-5', code: 'LUX', label: 'Luxe', order: 5, active: true },
];

export const MOCK_SUB_FAMILIES: ISubFamily[] = [
  { id: 'sfam-1', code: 'UNI', label: 'Unifocaux', familyId: 'OPT', order: 1, active: true },
  { id: 'sfam-2', code: 'PRO', label: 'Progressifs', familyId: 'OPT', order: 2, active: true },
  { id: 'sfam-3', code: 'POL', label: 'Polarisés', familyId: 'SOL', order: 1, active: true },
  { id: 'sfam-4', code: 'MIR', label: 'Miroirs', familyId: 'SOL', order: 2, active: true },
  { id: 'sfam-5', code: 'CYC', label: 'Cyclisme', familyId: 'SPO', order: 1, active: true },
  { id: 'sfam-6', code: 'SKI', label: 'Ski', familyId: 'SPO', order: 2, active: true },
  { id: 'sfam-7', code: 'BEB', label: 'Bébé', familyId: 'ENF', order: 1, active: true },
  { id: 'sfam-8', code: 'ADO', label: 'Adolescent', familyId: 'ENF', order: 2, active: true },
];

export const MOCK_COLORS: IColor[] = [
  { id: 'col-1', code: 'NOR', label: 'Noir', hexCode: '#000000', order: 1, active: true },
  { id: 'col-2', code: 'MAR', label: 'Marron', hexCode: '#8B4513', order: 2, active: true },
  { id: 'col-3', code: 'BLE', label: 'Bleu', hexCode: '#0000FF', order: 3, active: true },
  { id: 'col-4', code: 'VER', label: 'Vert', hexCode: '#008000', order: 4, active: true },
  { id: 'col-5', code: 'ROU', label: 'Rouge', hexCode: '#FF0000', order: 5, active: true },
  { id: 'col-6', code: 'GRI', label: 'Gris', hexCode: '#808080', order: 6, active: true },
  { id: 'col-7', code: 'DOR', label: 'Doré', hexCode: '#FFD700', order: 7, active: true },
  { id: 'col-8', code: 'ARG', label: 'Argenté', hexCode: '#C0C0C0', order: 8, active: true },
  { id: 'col-9', code: 'TRA', label: 'Transparent', hexCode: null, order: 9, active: true },
  { id: 'col-10', code: 'ECL', label: 'Écaille', hexCode: '#D2691E', order: 10, active: true },
];

export const MOCK_WAREHOUSES: IWarehouse[] = [
  {
    id: 1,
    name: 'Entrepôt Principal',
    capacity: 500,
    address: {
      street: '123 Rue Centrale',
      streetLine2: null,
      postcode: '20000',
      city: 'Casablanca',
      country: 'Maroc',
    },
    type: 'PRINCIPALE',
    active: true,
  },
  {
    id: 2,
    name: 'Entrepôt Secondaire',
    capacity: 200,
    address: {
      street: '45 Bd Mohammed V',
      streetLine2: null,
      postcode: '30000',
      city: 'Fès',
      country: 'Maroc',
    },
    type: 'SECONDAIRE',
    active: true,
  },
  {
    id: 3,
    name: 'Point de Vente Rabat',
    capacity: 100,
    address: {
      street: '78 Avenue Hassan II',
      streetLine2: null,
      postcode: '10000',
      city: 'Rabat',
      country: 'Maroc',
    },
    type: 'SECONDAIRE',
    active: true,
  },
];

export const MOCK_SUPPLIERS: ISupplier[] = [
  {
    id: 'sup-1',
    code: 'LUX',
    name: 'Luxottica',
    email: 'contact@luxottica.com',
    phone: '+39 02 1234567',
    address: {
      street: 'Via Cantù 2',
      streetLine2: null,
      postcode: '20123',
      city: 'Milan',
      country: 'Italie',
      lat: null,
      lon: null,
    },
    contactName: 'Marco Rossi',
    website: 'https://www.luxottica.com',
    ice: '001234567890123',
    tradeRegister: 'MI-123456',
    taxId: 'IT12345678901',
    businessLicense: null,
    siret: null,
    bank: 'Intesa Sanpaolo',
    bankAccountNumber: 'IT60X0542811101000000123456',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sup-2',
    code: 'SAF',
    name: 'Safilo',
    email: 'contact@safilo.com',
    phone: '+39 049 1234567',
    address: {
      street: 'Zona Industriale',
      streetLine2: null,
      postcode: '35127',
      city: 'Padoue',
      country: 'Italie',
      lat: null,
      lon: null,
    },
    contactName: 'Giuseppe Verdi',
    website: 'https://www.safilo.com',
    ice: '002345678901234',
    tradeRegister: 'PD-234567',
    taxId: 'IT98765432109',
    businessLicense: null,
    siret: null,
    bank: 'UniCredit',
    bankAccountNumber: 'IT40S0200802008000000654321',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'sup-3',
    code: 'MAR',
    name: 'Marchon',
    email: 'contact@marchon.com',
    phone: '+1 212 1234567',
    address: {
      street: '500 Madison Ave',
      streetLine2: null,
      postcode: '10022',
      city: 'New York',
      country: 'USA',
      lat: null,
      lon: null,
    },
    contactName: 'John Smith',
    website: 'https://www.marchon.com',
    ice: null,
    tradeRegister: null,
    taxId: '13-1234567',
    businessLicense: 'NYC-BL-12345',
    siret: null,
    bank: 'Chase',
    bankAccountNumber: '123456789',
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];
