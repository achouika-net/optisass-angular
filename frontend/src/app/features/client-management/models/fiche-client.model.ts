/**
 * Modèles pour les fiches client (montures, lentilles, produits)
 */

// ============ Enums ============

export enum TypeFiche {
    MONTURE = 'monture',
    LENTILLES = 'lentilles',
    PRODUIT = 'produit'
}

export enum StatutFiche {
    EN_COURS = 'en_cours',
    COMMANDE = 'commande',
    LIVRE = 'livre',
    ANNULE = 'annule'
}

export enum TypeVerre {
    UNIFOCAL = 'Unifocal',
    PROGRESSIF = 'Progressif',
    MI_DISTANCE = 'Mi-distance',
    DEGRESSIF = 'Dégressif'
}

export enum TypeLentille {
    JOURNALIERE = 'journaliere',
    MENSUELLE = 'mensuelle',
    ANNUELLE = 'annuelle'
}

export enum TypeEquipement {
    MONTURE = 'Monture',
    VISION_LOIN = 'Vision de loin',
    VISION_PRES = 'Vision de près',
    VISION_INTERMEDIAIRE = 'Vision intermédiaire',
    PROGRESSIFS = 'Progressifs',
    OPTIQUE_SOLAIRE = 'Optique solaire',
    SOLAIRE_SANS_CORRECTION = 'Solaire'
}

// ============ Suggestion IA ============

export interface SuggestionIA {
    type: 'OD' | 'OG' | 'Paire';
    matiere: string;
    indice: string;
    traitements?: string[];  // Traitements recommandés
    raison: string;
    epaisseur: string;
    warnings?: string[]; // Frame compatibility warnings
}

// ============ Prescription Interfaces ============

export interface PrescriptionOeil {
    sphere: number;
    cylindre?: number;
    axe?: number;
    addition?: number;
    prisme?: number;
}

export interface PrescriptionLentille extends PrescriptionOeil {
    rayonCourbure?: number;
    diametre?: number;
    k1?: number; // Kératométrie
    k2?: number;
}

// ============ Fiche de base ============

export interface FicheClientBase {
    id: string;
    numero?: number;
    clientId: string;
    type: TypeFiche;
    dateCreation: Date;
    dateLivraisonEstimee?: Date;
    dateLivraisonPrevue?: Date;
    dateLivraisonReelle?: Date;
    statut: StatutFiche;
    montantTotal: number;
    montantPaye: number;
    montantRestant: number;
    notes?: string;
    createdBy?: string; // ID de l'utilisateur
}

// ============ Fiche Monture ============

export interface OrdonnanceMonture {
    od: PrescriptionOeil;
    og: PrescriptionOeil;
    epOD: number; // Écart pupillaire OD
    epOG: number; // Écart pupillaire OG
    dateOrdonnance: Date;
    nomMedecin?: string;
}

export interface MontureDetails {
    produitId: string;
    reference: string;
    marque: string;
    modele: string;
    couleur: string;
    taille?: string;
    prix: number;
}

export interface VerresDetails {
    type: TypeVerre;
    traitement: string[]; // Anti-reflet, Anti-rayures, etc.
    indice: string; // Changed from number to string to support '1.50 (Standard)' format
    marque?: string;
    prixOD: number;
    prixOG: number;
}

export interface FicheMonture extends FicheClientBase {
    type: TypeFiche.MONTURE;
    ordonnance: OrdonnanceMonture;
    monture: MontureDetails;
    verres: VerresDetails;
    montage?: any;  // Fiche montage: écarts, hauteurs, type de montage
    suggestions?: SuggestionIA[];  // AI suggestions for lenses
    equipements?: any[];  // Additional equipment
}

// ============ Fiche Lentilles ============

export interface PrescriptionLentilles {
    od: PrescriptionLentille;
    og: PrescriptionLentille;
    dateOrdonnance: Date;
    nomMedecin?: string;
}

export interface AdaptationLentilles {
    dateEssai: Date;
    dateControle?: Date;
    acuiteOD?: string;
    acuiteOG?: string;
    confort?: string;
    centrage?: string;
    mobilite?: string;
    validation: boolean;
    remarques?: string;
}

export interface LentillesDetails {
    type: TypeLentille;
    usage: string; // Myopie, Astigmatisme, etc.
    od: {
        marque: string;
        modele: string;
        rayon: number;
        diametre: number;
        sphere?: number;
        cylindre?: number;
        axe?: number;
        addition?: number;
        prix?: number;
    };
    og: {
        marque: string;
        modele: string;
        rayon: number;
        diametre: number;
        sphere?: number;
        cylindre?: number;
        axe?: number;
        addition?: number;
        prix?: number;
    };
}

export interface FicheLentilles extends FicheClientBase {
    type: TypeFiche.LENTILLES;
    prescription: PrescriptionLentilles;
    lentilles: LentillesDetails;
    adaptation?: AdaptationLentilles;
}

// ============ Fiche Produit ============

export interface ProduitVendu {
    produitId: string;
    designation: string;
    reference: string;
    quantite: number;
    prixUnitaire: number;
    prixTotal: number;
}

export interface FicheProduit extends FicheClientBase {
    type: TypeFiche.PRODUIT;
    produits: ProduitVendu[];
}

// ============ Type Union ============

export type FicheClient = FicheMonture | FicheLentilles | FicheProduit;

// ============ Type Guards ============

export function isFicheMonture(fiche: FicheClient): fiche is FicheMonture {
    return fiche.type === TypeFiche.MONTURE;
}

export function isFicheLentilles(fiche: FicheClient): fiche is FicheLentilles {
    return fiche.type === TypeFiche.LENTILLES;
}

export function isFicheProduit(fiche: FicheClient): fiche is FicheProduit {
    return fiche.type === TypeFiche.PRODUIT;
}

// ============ Types pour création ============

export type FicheMontureCreate = Omit<FicheMonture, 'id' | 'dateCreation' | 'montantRestant'>;
export type FicheLentillesCreate = Omit<FicheLentilles, 'id' | 'dateCreation' | 'montantRestant'>;
export type FicheProduitCreate = Omit<FicheProduit, 'id' | 'dateCreation' | 'montantRestant'>;
