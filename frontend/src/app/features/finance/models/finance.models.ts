export interface Supplier {
    id: string;
    nom: string;
    contact?: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    ville?: string;
    siteWeb?: string;
    ice?: string;
    rc?: string;
    identifiantFiscal?: string;
    patente?: string;
    cnss?: string;
    siret?: string;
    banque?: string;
    rib?: string;
    conditionsPaiement?: string;
    conditionsPaiement2?: string;  // Temporary field for migration
    contacts?: SupplierContact[];
    convention?: any;
    createdAt?: string;
    updatedAt?: string;
}

export interface SupplierContact {
    nom: string;
    prenom: string;
    fonction: string;
    telephone: string;
    email: string;
    taches?: string[];
    canal?: string;
}

export interface Expense {
    id: string;
    date: string;
    montant: number;
    categorie: string;
    description?: string;
    modePaiement: string;
    statut: string;
    justificatifUrl?: string;
    reference?: string;
    banque?: string;
    dateEcheance?: string;
    centreId: string;
    centre?: { nom: string };
    fournisseurId?: string;
    fournisseur?: { nom: string };
    factureFournisseur?: { numeroFacture: string, fournisseur: { nom: string } };
    createdAt?: string;
}

export interface ExpenseDTO {
    date: string;
    montant: number;
    categorie: string;
    description?: string;
    modePaiement: string;
    statut: string;
    justificatifUrl?: string;
    reference?: string;
    banque?: string;
    dateEcheance?: string;
    centreId: string;
    fournisseurId?: string;
    factureFournisseurId?: string;
}

export interface SupplierInvoice {
    id: string;
    numeroFacture: string;
    dateEmission: string;
    dateEcheance?: string;
    montantHT: number;
    montantTVA: number;
    montantTTC: number;
    statut: string;
    type: string;
    isBL?: boolean;
    categorieBL?: string;
    parentInvoiceId?: string;
    parentInvoice?: SupplierInvoice;
    childBLs?: SupplierInvoice[];
    pieceJointeUrl?: string;
    fournisseurId: string;
    centreId?: string;
    clientId?: string;
    client?: any;
    fournisseur?: Supplier;
    echeances?: Echeance[];
    createdAt?: string;
}

export interface Echeance {
    id?: string;
    type: string;
    dateEcheance: string;
    dateEncaissement?: string;
    montant: number;
    statut: string;
    reference?: string; // CHEQUE/LCN num
    banque?: string;
}

export interface SupplierInvoiceDTO {
    numeroFacture: string;
    dateEmission: string;
    dateEcheance?: string;
    montantHT: number;
    montantTVA: number;
    montantTTC: number;
    statut: string;
    type: string;
    isBL?: boolean;
    categorieBL?: string;
    parentInvoiceId?: string;
    fournisseurId: string;
    clientId?: string;
    centreId?: string;
    pieceJointeUrl?: string;
    echeances?: Echeance[];
    base64File?: string;
    fileName?: string;
}

export interface FundingRequest {
    id: string;
    montant: number;
    statut: string;
    createdAt: string;
    validatedAt?: string;
    validatedBy?: string;
    remarque?: string;
    depenseId?: string;
    paiementId?: string;
    depense?: Expense;
    paiement?: any; // To be improved with Payment interface if needed
    journeeCaisse: {
        centreId: string;
        caisse: { nom: string };
    };
}
