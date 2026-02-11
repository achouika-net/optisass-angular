// Enums
export enum TitreClient {
    MR = 'Mr',
    MME = 'Mme',
    MLLE = 'Mlle',
    ENF = 'Enf'
}

export enum TypeCouverture {
    MUTUELLE = 'Mutuelle',
    CNSS = 'CNSS',
    RAMED = 'RAMED',
    AUTRE = 'Autre'
}

export enum TypeClient {
    PARTICULIER = 'particulier',
    ANONYME = 'anonyme',
    PROFESSIONNEL = 'professionnel'
}

export enum StatutClient {
    ACTIF = 'ACTIF',
    INACTIF = 'INACTIF',
    EN_COMPTE = 'EN_COMPTE',
    DE_PASSAGE = 'DE_PASSAGE'
}

export enum RoleClientFamille {
    PRINCIPAL = 'Principal',
    MEMBRE = 'Membre'
}

export enum LienParental {
    PARENT = 'Parent',
    ENFANT = 'Enfant',
    CONJOINT = 'Conjoint(e)',
    TUTEUR = 'Tuteur',
    AIDANT = 'Aidant'
}

// Interfaces communes
export enum TypePieceIdentite {
    CIN = 'CIN',
    PASSEPORT = 'Passeport',
    CARTE_SEJOUR = 'Carte de Résidence'
}

export enum ModalitePaiement {
    CHEQUE = 'Chèque',
    VIREMENT = 'Virement',
    ESPECES = 'Espèces',
    TRAITE = 'Traite',
    AUTRE = 'Autre'
}

export enum EcheancePaiement {
    COMPTANT = 'Comptant',
    J30 = '30 jours',
    J60 = '60 jours',
    J90 = '90 jours'
}

export enum TacheContact {
    DEVIS = 'Devis',
    FACTURE = 'Facture',
    BL = 'Bon de Livraison',
    COMMANDE = 'Commande',
    RELANCE = 'Relance Paiement',
    AUTRE = 'Autre'
}

export enum CanalCommunication {
    EMAIL = 'Email',
    WHATSAPP = 'WhatsApp',
    TELEPHONE = 'Téléphone',
    SMS = 'SMS',
    AUTRE = 'Autre'
}

// Interfaces communes
export interface Convention {
    actif: boolean;
    nomConvention?: string;
    contactNom?: string;
    contactPrenom?: string;
    contactTelephone?: string;
    remiseOfferte?: number; // Pourcentage
    modalitePaiement?: ModalitePaiement;
    echeancePaiement?: EcheancePaiement;
}

export interface GroupeFamille {
    role: RoleClientFamille;
    lienParental?: LienParental; // Si membre
    nomFamille?: string; // Auto-complete ou saisie
    beneficiaireOptique: boolean;
    responsableFinancier: boolean;
    mutuellePartagee: boolean;
    adressePartagee: boolean;
}

export interface CouvertureSociale {
    actif: boolean;
    type?: TypeCouverture;
    numeroAdhesion?: string;
}

export enum CorrectionVisuelle {
    LUNETTES = 'Lunettes',
    LENTILLES = 'Lentilles de contact',
    RIEN = 'Rien'
}

export enum DureePort {
    MOINS_1_AN = 'Moins de 1 an',
    ENTRE_1_ET_5_ANS = '1 à 5 ans',
    PLUS_5_ANS = 'Plus de 5 ans'
}

export interface DossierMedical {
    // Antécédents visuels
    correctionActuelle?: CorrectionVisuelle;
    dureePort?: DureePort;
    traumatisme?: boolean;
    operation?: boolean;
    inflammation?: boolean;
    sensibiliteLumiere?: boolean;
    secheresse?: boolean;
    antecedentsFamiliaux?: {
        glaucome: boolean;
        dmla: boolean;
        diabete: boolean;
        autres?: string;
    };

    // Antécédents médicaux généraux
    maladiesChroniques?: {
        actif: boolean;
        details?: string;
    };
    traitementMedicamenteux?: {
        actif: boolean;
        details?: string;
    };
    allergies?: {
        actif: boolean;
        details?: string;
    };

    // Habitudes et confort
    ecranPlus4h?: boolean;
    ressenti?: {
        fatigue: boolean;
        mauxTete: boolean;
        visionFloue: boolean;
        picotements: boolean;
        difficultePresLoin: boolean;
    };
    sport?: {
        actif: boolean;
        details?: string;
    };

    // Anciens champs (pour compatibilité ou remarques générales)
    remarques?: string;
    notes?: string; // Ajout Notes pour Particulier
}

export interface ContactProfessionnel {
    id?: string;
    nom: string;
    prenom: string;
    fonction: string;
    telephone: string;
    email: string;
    taches?: TacheContact[];
    canal?: CanalCommunication;
}

// Interface de base
export interface ClientBase {
    id?: string;
    typeClient: TypeClient;
    telephone?: string;
    ville?: string;
    adresse?: string;
    statut: StatutClient;
    dateCreation?: Date;
    derniereVisite?: Date;
    pointsFidelite?: number;
    parrainId?: string;
    parrain?: any;
    groupeId?: string;
    groupe?: any;
    filleuls?: any[];
    pointsHistory?: any[];
}

// Client Particulier
export interface ClientParticulier extends ClientBase {
    typeClient: TypeClient.PARTICULIER;
    titre: TitreClient;
    nom: string;
    prenom: string;
    typePieceIdentite?: TypePieceIdentite; // Modifié
    numeroPieceIdentite?: string; // Modifié
    cinParent?: string; // Si mineur
    dateNaissance: Date;
    telephone: string; // Obligatoire pour Particulier
    email?: string;
    ville: string; // Obligatoire pour Particulier
    // Convention retirée pour Particulier
    groupeFamille?: GroupeFamille;
    couvertureSociale?: CouvertureSociale;
    dossierMedical?: DossierMedical;
    parrainId?: string; // Pour programme fidélité
}

// Client Anonyme
export interface ClientAnonyme extends ClientBase {
    typeClient: TypeClient.ANONYME;
    nom?: string; // Ajout
    prenom?: string; // Ajout
}

// Client Professionnel
export interface ClientProfessionnel extends ClientBase {
    typeClient: TypeClient.PROFESSIONNEL;
    raisonSociale: string;
    identifiantFiscal: string;
    ice: string; // Identifiant Commun de l'Entreprise
    registreCommerce?: string; // Renommé de numeroSociete
    patente?: string; // Ajout
    telephone: string; // Obligatoire pour Professionnel
    email: string; // Obligatoire pour Professionnel
    ville: string; // Obligatoire pour Professionnel
    convention?: Convention;
    contacts: ContactProfessionnel[]; // Au moins un contact
    typePartenariat?: string;
    facturationGroupee?: boolean;
    tvaAssujetti?: boolean;
    numeroAutorisation?: string;
}

// Type union pour tous les clients
export type Client = ClientParticulier | ClientAnonyme | ClientProfessionnel;

// Type guards pour vérifier le type de client
export function isClientParticulier(client: Client): client is ClientParticulier {
    return client.typeClient === TypeClient.PARTICULIER;
}

export function isClientAnonyme(client: Client): client is ClientAnonyme {
    return client.typeClient === TypeClient.ANONYME;
}

export function isClientProfessionnel(client: Client): client is ClientProfessionnel {
    return client.typeClient === TypeClient.PROFESSIONNEL;
}

// Interface pour la création/édition (sans id et dates auto-générées)
export type ClientCreate = Omit<Client, 'id' | 'dateCreation' | 'derniereVisite' | 'pointsFidelite'>;
