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
    banque?: string;
    rib?: string;
    conditionsPaiement?: string;
    createdAt?: string;
    updatedAt?: string;
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
    centreId: string;
    centre?: { nom: string };
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
    centreId: string;
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
    pieceJointeUrl?: string;
    fournisseurId: string;
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
    fournisseurId: string;
    pieceJointeUrl?: string;
    echeances?: Echeance[];
}
