/**
 * Warehouse Hierarchy Interfaces
 */

export enum EntrepotType {
    PRINCIPAL = 'PRINCIPAL',
    SECONDAIRE = 'SECONDAIRE',
    TRANSIT = 'TRANSIT',
}

export interface Groupe {
    id: string;
    nom: string;
    description?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    centres?: Centre[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Centre {
    id: string;
    nom: string;
    description?: string;
    adresse?: string;
    ville?: string;
    codePostal?: string;
    telephone?: string;
    email?: string;
    groupeId: string;
    groupe?: Groupe;
    entrepots?: Entrepot[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Entrepot {
    id: string;
    nom: string;
    description?: string;
    type: EntrepotType;
    capaciteMax?: number;
    surface?: number;
    responsable?: string;
    centreId: string;
    centre?: Centre;
    produits?: any[];
    createdAt: Date;
    updatedAt: Date;
}

export interface StockTransfer {
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    motif: string;
    utilisateur: string;
}

export interface StockSummary {
    entrepot: {
        id: string;
        nom: string;
        type: EntrepotType;
    };
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
}
