import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    FicheClient,
    FicheMonture,
    FicheLentilles,
    FicheProduit,
    FicheMontureCreate,
    FicheLentillesCreate,
    FicheProduitCreate,
    StatutFiche,
    TypeFiche
} from '../models/fiche-client.model';

import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class FicheService {
    private apiUrl = `${API_URL}/fiches`;

    constructor(private http: HttpClient) { }

    /**
     * Récupérer toutes les fiches d'un client
     */
    getFichesByClient(clientId: string, startDate?: string): Observable<FicheClient[]> {
        let url = `${this.apiUrl}?clientId=${clientId}`;
        if (startDate) url += `&startDate=${startDate}`;
        return this.http.get<any[]>(url).pipe(
            map(fiches => fiches.map(f => this.mapBackendToFrontend(f)))
        );
    }

    /**
     * Récupérer une fiche par ID
     */
    getFicheById(id: string): Observable<FicheClient | undefined> {
        return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
            map(f => f ? this.mapBackendToFrontend(f) : undefined)
        );
    }

    /**
     * Créer une fiche monture
     */
    createFicheMonture(fiche: FicheMontureCreate): Observable<FicheMonture> {
        const payload = this.mapFrontendToBackendCreate(fiche);
        return this.http.post<any>(this.apiUrl, payload).pipe(
            map(created => this.mapBackendToFrontend(created) as FicheMonture)
        );
    }

    /**
     * Créer une fiche lentilles
     */
    createFicheLentilles(fiche: FicheLentillesCreate): Observable<FicheLentilles> {
        const payload = this.mapFrontendToBackendCreate(fiche);
        return this.http.post<any>(this.apiUrl, payload).pipe(
            map(created => this.mapBackendToFrontend(created) as FicheLentilles)
        );
    }

    /**
     * Créer une fiche produit
     */
    createFicheProduit(fiche: FicheProduitCreate): Observable<FicheProduit> {
        const payload = this.mapFrontendToBackendCreate(fiche);
        return this.http.post<any>(this.apiUrl, payload).pipe(
            map(created => this.mapBackendToFrontend(created) as FicheProduit)
        );
    }

    /**
     * Mettre à jour une fiche
     */
    updateFiche(id: string, updates: Partial<FicheClient>): Observable<FicheClient> {
        const payload = this.mapFrontendToBackendUpdate(updates);
        return this.http.put<any>(`${this.apiUrl}/${id}`, payload).pipe(
            map(updated => this.mapBackendToFrontend(updated))
        );
    }

    /**
     * Supprimer une fiche
     */
    deleteFiche(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
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
        return this.getFichesByClient(clientId).pipe(
            map(clientFiches => {
                const stats = {
                    total: clientFiches.length,
                    enCours: clientFiches.filter(f => f.statut === StatutFiche.EN_COURS).length,
                    commande: clientFiches.filter(f => f.statut === StatutFiche.COMMANDE).length,
                    livre: clientFiches.filter(f => f.statut === StatutFiche.LIVRE).length,
                    montantTotal: clientFiches.reduce((sum, f) => sum + f.montantTotal, 0),
                    montantRestant: clientFiches.reduce((sum, f) => sum + (f.montantRestant || 0), 0)
                };
                return stats;
            })
        );
    }

    // --- Mappers ---

    private mapFrontendToBackendCreate(fiche: any): any {
        const { id, clientId, statut, type, montantTotal, montantPaye, dateCreation, dateLivraisonEstimee, ...content } = fiche;

        return {
            clientId,
            statut,
            type,
            montantTotal,
            montantPaye: montantPaye || 0,
            dateLivraisonEstimee,
            content: content // Store the rest as JSON content
        };
    }

    private mapFrontendToBackendUpdate(updates: Partial<FicheClient>): any {
        const { id, clientId, statut, type, montantTotal, montantPaye, dateCreation, dateLivraisonEstimee, ...content } = updates as any;

        const payload: any = {};
        if (statut !== undefined) payload.statut = statut;
        if (type !== undefined) payload.type = type;
        if (montantTotal !== undefined) payload.montantTotal = montantTotal;
        if (montantPaye !== undefined) payload.montantPaye = montantPaye;
        if (dateLivraisonEstimee !== undefined) payload.dateLivraisonEstimee = dateLivraisonEstimee;

        // If there are content fields, we ideally need to merge them with existing content or replace.
        // For simplicity with PUT, we might be replacing or needing to fetch first.
        // Backend PUT usually replaces. If we want partial update of content, we need a smarter backend or fetch-merge-save.
        // Assuming updates contains the specific fields we want to save into content.
        if (Object.keys(content).length > 0) {
            payload.content = content;
        }

        return payload;
    }

    private mapBackendToFrontend(backendFiche: any): FicheClient {
        const { content, ...meta } = backendFiche;
        // recalculate montantRestant as it is not stored in DB usually (calculated)
        const montantRestant = meta.montantTotal - meta.montantPaye;

        return {
            ...meta,
            ...content, // Spread content back to top level
            montantRestant
        } as FicheClient;
    }
}
