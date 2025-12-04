import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
    FicheClient,
    FicheMonture,
    FicheLentilles,
    FicheProduit,
    FicheMontureCreate,
    FicheLentillesCreate,
    FicheProduitCreate,
    StatutFiche,
    TypeFiche,
    TypeVerre,
    TypeLentille
} from '../models/fiche-client.model';

@Injectable({
    providedIn: 'root'
})
export class FicheService {
    // Mock data pour démonstration
    private fiches: FicheClient[] = [
        // Fiche Monture exemple
        // Fiche Monture exemple supprimée pour ne pas ralentir/polluer l'affichage
        // { ... }
        // Fiche Lentilles exemple
        {
            id: 'f2',
            clientId: '1',
            type: TypeFiche.LENTILLES,
            dateCreation: new Date('2024-10-20'),
            statut: StatutFiche.COMMANDE,
            montantTotal: 450,
            montantPaye: 200,
            montantRestant: 250,
            prescription: {
                od: { sphere: -3.0, cylindre: -0.5, axe: 180, rayonCourbure: 8.6, diametre: 14.2 },
                og: { sphere: -2.75, cylindre: -0.25, axe: 175, rayonCourbure: 8.6, diametre: 14.2 },
                dateOrdonnance: new Date('2024-10-15'),
                nomMedecin: 'Dr. Bennani'
            },
            lentilles: {
                type: TypeLentille.MENSUELLE,
                usage: 'Myopie',
                od: {
                    marque: 'Acuvue',
                    modele: 'Oasys',
                    rayon: 8.6,
                    diametre: 14.2,
                    prix: 75
                },
                og: {
                    marque: 'Acuvue',
                    modele: 'Oasys',
                    rayon: 8.6,
                    diametre: 14.2,
                    prix: 75
                }
            }
        }
    ];

    constructor() { }

    /**
     * Récupérer toutes les fiches d'un client
     */
    getFichesByClient(clientId: string): Observable<FicheClient[]> {
        const clientFiches = this.fiches.filter(f => f.clientId === clientId);
        return of(clientFiches);
    }

    /**
     * Récupérer une fiche par ID
     */
    getFicheById(id: string): Observable<FicheClient | undefined> {
        const fiche = this.fiches.find(f => f.id === id);
        return of(fiche);
    }

    /**
     * Créer une fiche monture
     */
    createFicheMonture(fiche: FicheMontureCreate): Observable<FicheMonture> {
        const newFiche: FicheMonture = {
            ...fiche,
            id: this.generateId(),
            dateCreation: new Date(),
            montantRestant: fiche.montantTotal - fiche.montantPaye
        };
        this.fiches.push(newFiche);
        return of(newFiche);
    }

    /**
     * Créer une fiche lentilles
     */
    createFicheLentilles(fiche: FicheLentillesCreate): Observable<FicheLentilles> {
        const newFiche: FicheLentilles = {
            ...fiche,
            id: this.generateId(),
            dateCreation: new Date(),
            montantRestant: fiche.montantTotal - fiche.montantPaye
        };
        this.fiches.push(newFiche);
        return of(newFiche);
    }

    /**
     * Créer une fiche produit
     */
    createFicheProduit(fiche: FicheProduitCreate): Observable<FicheProduit> {
        const newFiche: FicheProduit = {
            ...fiche,
            id: this.generateId(),
            dateCreation: new Date(),
            montantRestant: fiche.montantTotal - fiche.montantPaye
        };
        this.fiches.push(newFiche);
        return of(newFiche);
    }

    /**
     * Mettre à jour une fiche
     */
    updateFiche(id: string, updates: Partial<FicheClient>): Observable<FicheClient> {
        const index = this.fiches.findIndex(f => f.id === id);
        if (index !== -1) {
            this.fiches[index] = { ...this.fiches[index], ...updates } as FicheClient;
            // Recalculer le montant restant si nécessaire
            if (updates.montantTotal !== undefined || updates.montantPaye !== undefined) {
                this.fiches[index].montantRestant =
                    this.fiches[index].montantTotal - this.fiches[index].montantPaye;
            }
            return of(this.fiches[index]);
        }
        throw new Error('Fiche non trouvée');
    }

    /**
     * Supprimer une fiche
     */
    deleteFiche(id: string): Observable<void> {
        const index = this.fiches.findIndex(f => f.id === id);
        if (index !== -1) {
            this.fiches.splice(index, 1);
        }
        return of(void 0);
    }

    /**
     * Générer un ID unique
     */
    private generateId(): string {
        return 'f' + Date.now() + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Obtenir les statistiques des fiches d'un client
     */
    getClientFichesStats(clientId: string): Observable<{
        total: number;
        enCours: number;
        commande: number;
        livre: number;
        montantTotal: number;
        montantRestant: number;
    }> {
        const clientFiches = this.fiches.filter(f => f.clientId === clientId);

        const stats = {
            total: clientFiches.length,
            enCours: clientFiches.filter(f => f.statut === StatutFiche.EN_COURS).length,
            commande: clientFiches.filter(f => f.statut === StatutFiche.COMMANDE).length,
            livre: clientFiches.filter(f => f.statut === StatutFiche.LIVRE).length,
            montantTotal: clientFiches.reduce((sum, f) => sum + f.montantTotal, 0),
            montantRestant: clientFiches.reduce((sum, f) => sum + f.montantRestant, 0)
        };

        return of(stats);
    }
}
