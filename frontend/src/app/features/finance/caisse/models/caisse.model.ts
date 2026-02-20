export enum CaisseStatut {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export enum CaisseType {
    PRINCIPALE = 'PRINCIPALE',
    DEPENSES = 'DEPENSES',
    MIXTE = 'MIXTE',
}

export interface Caisse {
    id: string;
    nom: string;
    description?: string;
    type: CaisseType;
    statut: CaisseStatut;
    centreId: string;
    centre?: {
        id: string;
        nom: string;
    };
    journees?: JourneeCaisse[];
    createdAt: Date;
    updatedAt: Date;
}

export enum JourneeStatut {
    OUVERTE = 'OUVERTE',
    FERMEE = 'FERMEE',
}

export interface JourneeCaisse {
    id: string;
    dateOuverture: Date;
    dateCloture?: Date;
    fondInitial: number;
    soldeTheorique?: number;
    soldeReel?: number;
    ecart?: number;
    justificationEcart?: string;
    statut: JourneeStatut;
    caissier: string;
    responsableCloture?: string;
    totalComptable: number;
    totalVentesEspeces: number;
    totalVentesCarte: number;
    totalVentesCheque: number;
    totalInterne: number;
    totalDepenses: number;
    totalTransfertsDepenses: number;
    caisseId: string;
    centreId: string;
    caisse?: Caisse;
    centre?: {
        id: string;
        nom: string;
    };
    operations?: OperationCaisse[];
    createdAt: Date;
    updatedAt: Date;
}

export enum OperationType {
    ENCAISSEMENT = 'ENCAISSEMENT',
    DECAISSEMENT = 'DECAISSEMENT',
}

export enum TypeOperation {
    COMPTABLE = 'COMPTABLE',
    INTERNE = 'INTERNE',
}

export enum MoyenPaiement {
    ESPECES = 'ESPECES',
    CARTE = 'CARTE',
    VIREMENT = 'VIREMENT',
    CHEQUE = 'CHEQUE',
}

export interface OperationCaisse {
    id: string;
    type: OperationType;
    typeOperation: TypeOperation;
    montant: number;
    moyenPaiement: MoyenPaiement;
    reference?: string;
    motif?: string;
    pieceJointe?: string;
    utilisateur: string;
    journeeCaisseId: string;
    factureId?: string;
    journeeCaisse?: JourneeCaisse;
    facture?: {
        numero: string;
        client?: {
            nom?: string;
            prenom?: string;
        };
    };
    user?: {
        nom: string;
        prenom: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateCaisseDto {
    nom: string;
    description?: string;
    type?: CaisseType;
    statut?: CaisseStatut;
    centreId: string;
}

export interface UpdateCaisseDto {
    nom?: string;
    description?: string;
    type?: CaisseType;
    statut?: CaisseStatut;
}

export interface OuvrirCaisseDto {
    caisseId: string;
    centreId: string;
    fondInitial: number;
    caissier: string;
}

export interface CloturerCaisseDto {
    soldeReel: number;
    nbRecuCarte: number;
    montantTotalCarte: number;
    nbRecuCheque: number;
    montantTotalCheque: number;
    justificationEcart?: string;
    responsableCloture: string;
}

export interface CreateOperationCaisseDto {
    type: OperationType;
    typeOperation: TypeOperation;
    montant: number;
    moyenPaiement: MoyenPaiement;
    reference?: string;
    motif?: string;
    pieceJointe?: string;
    utilisateur: string;
    journeeCaisseId: string;
    factureId?: string;
}

export interface JourneeResume {
    journee: {
        id: string;
        dateOuverture: Date;
        dateCloture?: Date;
        statut: JourneeStatut;
        caissier: string;
        caisse: Caisse;
        centre: {
            id: string;
            nom: string;
        };
    };
    fondInitial: number;
    totalComptable: number;
    totalVentesEspeces: number;
    totalVentesCarte: number;
    totalVentesCheque: number;
    totalRecettes: number;
    recettesDetails: {
        espaces: number;
        carte: number;
        cheque: number;
        enCoffre: number;
        carteCount: number;
        chequeCount: number;
        enCoffreCount: number;
    };
    totalInterne: number;
    totalDepenses: number;
    totalDepensesCash: number;
    totalDepensesBank: number;
    totalTransfertsDepenses: number;
    nbVentesCarte: number;
    nbVentesCheque: number;
    soldeTheorique: number;
    soldeReel?: number;
    ecart?: number;
}

export interface OperationStats {
    totalComptable: number;
    totalInterne: number;
    totalDepenses: number;
    countComptable: number;
    countInterne: number;
    countDepenses: number;
    byMoyenPaiement: Record<string, number>;
}
