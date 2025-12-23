/**
 * Product Types and Categories
 */
export enum ProductType {
    MONTURE = 'monture',
    VERRE = 'verre',
    LENTILLE = 'lentille',
    ACCESSOIRE = 'accessoire'
}

export enum ProductStatus {
    DISPONIBLE = 'DISPONIBLE',
    RESERVE = 'RESERVE',
    EN_COMMANDE = 'EN_COMMANDE',
    EN_TRANSIT = 'EN_TRANSIT',
    RUPTURE = 'RUPTURE',
    OBSOLETE = 'OBSOLETE'
}

/**
 * Base Product Interface
 * Common fields for all product types
 */
export interface BaseProduct {
    id?: string;
    codeInterne: string;           // Auto-generated
    codeBarres: string;             // Auto-generated or manual
    referenceFournisseur?: string;
    designation: string;
    marque?: string;
    modele?: string;
    couleur?: string;

    // Classification
    typeArticle: ProductType;
    famille?: string;
    sousFamille?: string;
    fournisseurPrincipal?: string;

    // Stock & Pricing
    quantiteActuelle: number;
    seuilAlerte: number;
    prixAchatHT: number;           // Weighted average price
    coefficient: number;
    prixVenteHT: number;           // Calculated automatically
    prixVenteTTC: number;          // Calculated with VAT
    tauxTVA: number;               // VAT rate (default 20%)

    // Traceability
    dateCreation: Date;
    dateModification: Date;

    // Metadata
    photo?: string;
    statut: ProductStatus;
    utilisateurCreation: string;
    specificData?: any;

    // Warehouse Association
    entrepotId?: string;
    entrepot?: any; // Will be typed as Entrepot when imported

    // New field for Billing Workflow
    sourceStock?: 'PRINCIPALE' | 'SECONDAIRE';
}

/**
 * Purchase History Entry
 */
export interface PurchaseHistory {
    id?: string;
    date: Date;
    fournisseur: string;
    quantite: number;
    prixAchatUnitaire: number;
    prixAchatTotal: number;
    numeroCommande?: string;
}

/**
 * Frame (Monture) specific fields
 */
export enum FrameCategory {
    OPTIQUE = 'optique',
    SOLAIRE = 'solaire'
}

export enum Gender {
    HOMME = 'homme',
    FEMME = 'femme',
    ENFANT = 'enfant',
    MIXTE = 'mixte'
}

export enum FrameShape {
    RONDE = 'ronde',
    CARREE = 'carree',
    RECTANGULAIRE = 'rectangulaire',
    PAPILLON = 'papillon',
    AVIATEUR = 'aviateur',
    OVALE = 'ovale',
    AUTRE = 'autre'
}

export enum FrameMaterial {
    ACETATE = 'acetate',
    METAL = 'metal',
    TITANE = 'titane',
    MIXTE = 'mixte',
    PLASTIQUE = 'plastique',
    AUTRE = 'autre'
}

export enum HingeType {
    STANDARD = 'standard',
    FLEX = 'flex',
    RESSORT = 'ressort'
}

export enum FrameType {
    CERCLEE = 'cerclee',
    NYLOR = 'nylor',
    PERCEE = 'percee'
}

export interface Frame extends BaseProduct {
    typeArticle: ProductType.MONTURE;

    // Frame specific
    categorie: FrameCategory;
    genre: Gender;
    forme: FrameShape;
    matiere: FrameMaterial;
    couleurMonture: string;
    couleurBranches?: string;

    // Dimensions (calibre-pont-branche)
    calibre: number;               // ex: 52
    pont: number;                  // ex: 18
    branche: number;               // ex: 140

    // Characteristics
    typeCharniere?: HingeType;
    typeMonture: FrameType;

    // Visuals
    photoFace?: string;
    photoProfil?: string;

    // Virtual try-on
    essayageVirtuelId?: string;
}

/**
 * Lens (Verre) specific fields
 */
export enum LensType {
    UNIFOCAL = 'unifocal',
    PROGRESSIF = 'progressif',
    DEGRESSIF = 'degressif',
    BIFOCAL = 'bifocal',
    TRIFOCAL = 'trifocal',
    MI_DISTANCE = 'mi_distance',
    BUREAU = 'bureau',
    SPORT = 'sport'
}

export enum LensMaterial {
    ORGANIQUE = 'organique',
    POLYCARBONATE = 'polycarbonate',
    MINERAL = 'mineral',
    TRIVEX = 'trivex',
    HAUT_INDICE = 'haut_indice',
    CR39 = 'cr39'
}

export enum LensTint {
    BLANC = 'blanc',
    PHOTOCHROMIQUE = 'photochromique',
    SOLAIRE = 'solaire',
    POLARISANT = 'polarisant',
    AUTRE = 'autre'
}

export enum LensFilter {
    BLEU = 'filtre_bleu',
    UV = 'uv'
}

export enum LensTreatment {
    ANTIREFLET = 'antireflet',
    DURCI = 'durci',
    HYDROPHOBE = 'hydrophobe',
    OLEOPHOBE = 'oleophobe',
    UV = 'uv',
    ANTI_RAYURE = 'anti_rayure',
    FILTRE_LUMIERE_BLEUE = 'filtre_lumiere_bleue',
    ANTI_BUEE = 'anti_buee',
    ANTI_SALISSURE = 'anti_salissure',
    SUPER_HYDROPHOBE = 'super_hydrophobe'
}

export enum LensIndex {
    INDEX_1_5 = '1.5',
    INDEX_1_53 = '1.53',
    INDEX_1_56 = '1.56',
    INDEX_1_59 = '1.59',
    INDEX_1_6 = '1.6',
    INDEX_1_67 = '1.67',
    INDEX_1_74 = '1.74'
}

export interface Lens extends BaseProduct {
    typeArticle: ProductType.VERRE;

    // Lens type
    typeVerre: LensType;
    materiau: LensMaterial;
    indiceRefraction: number;      // 1.5, 1.6, 1.67, 1.74

    // Tints and filters
    teinte?: LensTint;
    filtres?: LensFilter[];
    traitements?: LensTreatment[];

    // Optical characteristics
    puissanceSph?: number;
    puissanceCyl?: number;
    axe?: number;
    addition?: number;
    diametre?: number;
    base?: number;
    courbure?: number;

    // Manufacturer
    fabricant: string;
    familleOptique?: string;
}

/**
 * Contact Lens (Lentille) specific fields
 */
export enum ContactLensType {
    JOURNALIERE = 'journaliere',
    BIMENSUELLE = 'bimensuelle',
    MENSUELLE = 'mensuelle',
    ANNUELLE = 'annuelle'
}

export enum ContactLensUsage {
    MYOPIE = 'myopie',
    HYPERMETROPIE = 'hypermetropie',
    ASTIGMATISME = 'astigmatisme',
    PRESBYTIE = 'presbytie',
    COSMETIQUE = 'cosmetique'
}

export interface ContactLens extends BaseProduct {
    typeArticle: ProductType.LENTILLE;

    // Type and usage
    typeLentille: ContactLensType;
    usage: ContactLensUsage;
    modeleCommercial: string;
    laboratoire: string;

    // Optical parameters
    puissanceSph: number;          // PWR
    cylindre?: number;             // CYL
    axe?: number;                  // AX
    addition?: number;             // ADD
    rayonCourbure: number;         // BC
    diametre: number;              // DIA

    // Packaging
    nombreParBoite: number;
    prixParBoite: number;
    prixParUnite: number;

    // Lot traceability
    numeroLot?: string;
    datePeremption?: Date;

    // Multi-unit stock
    quantiteBoites: number;
    quantiteUnites: number;
}

/**
 * Accessory (Accessoire) specific fields
 */
export enum AccessoryCategory {
    ETUI = 'etui',
    CHIFFON = 'chiffon',
    CORDON = 'cordon',
    VISSERIE = 'visserie',
    ENTRETIEN = 'entretien',
    PRESENTATION = 'presentation',
    AUTRE = 'autre'
}

export interface Accessory extends BaseProduct {
    typeArticle: ProductType.ACCESSOIRE;

    categorie: AccessoryCategory;
    sousCategorie?: string;
}

/**
 * Union type for all product types
 */
export type Product = Frame | Lens | ContactLens | Accessory;

/**
 * Stock Movement
 */
export enum MovementType {
    ENTREE_ACHAT = 'entree_achat',
    ENTREE_RETOUR_CLIENT = 'entree_retour_client',
    ENTREE_INVENTAIRE = 'entree_inventaire',
    SORTIE_VENTE = 'sortie_vente',
    SORTIE_RETOUR_FOURNISSEUR = 'sortie_retour_fournisseur',
    SORTIE_INVENTAIRE = 'sortie_inventaire',
    SORTIE_CASSE = 'sortie_casse'
}

export interface StockMovement {
    id?: string;
    produitId: string;
    type: MovementType;
    quantite: number;
    dateMovement: Date;
    motif: string;
    utilisateur: string;

    // Details based on type
    fournisseurId?: string;
    clientId?: string;
    factureId?: string;

    // Prices at movement time
    prixAchatUnitaire?: number;
    prixVenteUnitaire?: number;

    // Traceability
    numeroLot?: string;
    datePeremption?: Date;
}

/**
 * Stock Alert
 */
export enum AlertType {
    STOCK_BAS = 'stock_bas',
    PEREMPTION_PROCHE = 'peremption_proche',
    RUPTURE = 'rupture'
}

export interface StockAlert {
    id?: string;
    produitId: string;
    type: AlertType;
    message: string;
    dateCreation: Date;
    lu: boolean;
    datePeremption?: Date;
}

/**
 * Barcode
 */
export enum BarcodeType {
    EAN13 = 'ean13',
    CODE128 = 'code128',
    QRCODE = 'qrcode'
}

export interface BarcodeConfig {
    type: BarcodeType;
    width: number;
    height: number;
    displayValue: boolean;
}

/**
 * Label Format
 */
export enum LabelFormat {
    SMALL = 'small',           // 40x20mm
    MEDIUM = 'medium',         // 60x40mm
    LARGE = 'large'            // 80x60mm
}

/**
 * Product Filters
 */
export interface ProductFilters {
    entrepotId?: string; // Warehouse filter
    typeArticle?: ProductType;
    marque?: string;
    famille?: string;
    statut?: ProductStatus;
    stockMin?: number;
    stockMax?: number;
    prixMin?: number;
    prixMax?: number;
    search?: string;
    global?: boolean;
}

/**
 * Stock Statistics
 */
export interface StockStats {
    totalProduits: number;
    valeurStockTotal: number;
    caNonConsolide: number;
    produitsStockBas: number;
    produitsRupture: number;
    produitsReserves: number;
    produitsEnTransit: number;
    byType: {
        montures: number;
        verres: number;
        lentilles: number;
        accessoires: number;
    };
}
