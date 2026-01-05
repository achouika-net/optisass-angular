export interface Employee {
    id?: string;
    matricule?: string;
    nom: string;
    prenom: string;
    cin?: string;
    telephone?: string;
    email?: string;
    adresse?: string;
    poste: string; // OPTICIEN, VENDEUR, CAISSIER, RESPONSABLE, ADMIN
    contrat: string; // CDI, CDD, JOURNALIER, PARTIEL
    dateEmbauche?: string;
    salaireBase: number;
    statut: string; // ACTIF, SUSPENDU, SORTI
    userId?: string;
    centres?: any[];
}

export interface Attendance {
    id?: string;
    employeeId: string;
    date: string;
    heuresTravaillees: number;
    retardMinutes: number;
    estAbsent: boolean;
    motif?: string;
}

export interface Payroll {
    id?: string;
    employeeId: string;
    employee?: Employee;
    mois: string;
    annee: number;
    salaireBase: number;
    commissions: number;
    heuresSup: number;
    retenues: number;
    netAPayer: number;
    statut: string; // BROUILLON, VALIDE, PAYE
    pdfUrl?: string;
    expenseId?: string;
}

export interface CommissionRule {
    id?: string;
    poste: string;
    centreId?: string;
    typeProduit: string;
    taux: number;
}
