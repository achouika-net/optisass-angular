/**
 * User Management Interfaces and Types
 * Defines the data structures for user management in OptiSass
 */

/**
 * Main User interface
 */
export interface User {
    id: string;
    nom: string;
    prenom: string;
    civilite: Civilite;
    telephone?: string;
    email: string;
    photoUrl?: string; // Profile picture URL
    agrement?: string; // Optional field
    statut: UserStatus;
    centreRoles: CentreRole[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Center-Role association for a user
 */
export interface CentreRole {
    id: string;
    centreId: string;
    centreName: string;
    role: UserRole;
}

/**
 * User civilite options
 */
export enum Civilite {
    MONSIEUR = 'M',
    MADAME = 'Mme',
    MADEMOISELLE = 'Mlle'
}

/**
 * User status
 */
export enum UserStatus {
    ACTIF = 'actif',
    INACTIF = 'inactif'
}

/**
 * User roles in the system
 */
export enum UserRole {
    CENTRE = 'Centre',
    GERANT = 'Gérant',
    COMPTABLE = 'Comptable',
    VENDEUR = 'Vendeur',
    OPTICIEN = 'Opticien',
    ASSISTANT = 'Assistant',
    ADMIN = 'Administrateur'
}

/**
 * Filters for user search
 */
export interface UserFilters {
    nom?: string;
    prenom?: string;
    agrement?: string;
    statut?: UserStatus;
    role?: UserRole;
}

/**
 * User statistics
 */
export interface UserStats {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: { [key: string]: number };
}
