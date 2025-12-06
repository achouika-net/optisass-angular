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
    ACTIF = 'Actif',
    INACTIF = 'Inactif',
    EN_COMPTE = 'En compte',
    DE_PASSAGE = 'De passage'
}

export enum RoleClientFamille {
    PRINCIPAL = 'Principal',
    MEMBRE = 'Membre'
}

export enum LienParental {
    PARENT = 'Parent',
    ENFANT = 'Enfant',
    CONJOINT = 'Conjoint',
    TUTEUR = 'Tuteur',
    AIDANT = 'Aidant'
}

// Interfaces communes
export interface Convention {
    actif: boolean;
    nomConvention?: string;
    contactNom?: string;
    contactPrenom?: string;
    contactTelephone?: string;
    remiseOfferte?: number; // Pourcentage
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
}

export interface ContactProfessionnel {
    id?: string;
    nom: string;
    prenom: string;
    fonction: string;
    telephone: string;
    email: string;
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
}

// Client Particulier
export interface ClientParticulier extends ClientBase {
    typeClient: TypeClient.PARTICULIER;
    titre: TitreClient;
    nom: string;
    prenom: string;
    cin: string;
    cinParent?: string; // Si mineur
    dateNaissance: Date;
    telephone: string; // Obligatoire pour Particulier
    email?: string;
    ville: string; // Obligatoire pour Particulier
    convention?: Convention;
    groupeFamille?: GroupeFamille;
    couvertureSociale?: CouvertureSociale;
    dossierMedical?: DossierMedical;
    parrainId?: string; // Pour programme fidélité
}

// Client Anonyme
export interface ClientAnonyme extends ClientBase {
    typeClient: TypeClient.ANONYME;
    // Tous les champs sont facultatifs (hérités de ClientBase)
    nom?: string;
    prenom?: string;
}

// Client Professionnel
export interface ClientProfessionnel extends ClientBase {
    typeClient: TypeClient.PROFESSIONNEL;
    raisonSociale: string;
    identifiantFiscal: string;
    ice: string; // Identifiant Commun de l'Entreprise
    numeroSociete?: string;
    telephone: string; // Obligatoire pour Professionnel
    email: string; // Obligatoire pour Professionnel
    ville: string; // Obligatoire pour Professionnel
    convention?: Convention;
    contacts: ContactProfessionnel[]; // Au moins un contact
    typePartenariat?: string;
    facturationGroupee?: boolean;
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
