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
     * Récupérer toutes les fiches (pour l'historique global)
     */
    getAllFiches(startDate?: string): Observable<FicheClient[]> {
        let url = `${this.apiUrl}?all=true`;
        if (startDate) url += `&startDate=${startDate}`;
        return this.http.get<any[]>(url).pipe(
            map(fiches => fiches.map(f => this.mapBackendToFrontend(f)))
        );
    }

    /**
     * Récupérer l'historique global des BC via l'endpoint optimisé
     * (ne charge plus toutes les fiches complètes côté client)
     */
    getAllBcHistory(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/bc-history`);
    }


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
     * Envoyer le bon de commande par email au fournisseur
     */
    sendOrderEmail(id: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${id}/email-order`, {});
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

    // --- Actions ---
    emailOrder(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/${id}/email-order`, {});
    }

    // --- Mappers ---

    private mapFrontendToBackendCreate(fiche: any): any {
        const { id, clientId, statut, type, montantTotal, montantPaye, dateCreation, dateLivraisonEstimee, ...content } = fiche;

        console.log('📦 [FicheService] mapFrontendToBackendCreate - content keys:', Object.keys(content));

        return {
            clientId,
            statut,
            type,
            montantTotal,
            montantPaye: montantPaye || 0,
            dateLivraisonEstimee,
            content: {
                ...content,
                // Ensure specific sections are preserved even if deeply nested in some models
                ordonnance: fiche.ordonnance || fiche.prescription || content.ordonnance,
                lentilles: fiche.lentilles || content.lentilles,
                adaptation: fiche.adaptation || content.adaptation,
                suiviCommande: fiche.suiviCommande || content.suiviCommande,
                monture: fiche.monture || content.monture,
                verres: fiche.verres || content.verres,
                montage: fiche.montage || content.montage,
                produits: fiche.produits || content.produits
            }
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

        // Ensure we are sending the structured content
        const structuredContent = {
            ...content,
            ordonnance: (updates as any).ordonnance || (updates as any).prescription || content.ordonnance,
            lentilles: (updates as any).lentilles || content.lentilles,
            adaptation: (updates as any).adaptation || content.adaptation,
            suiviCommande: (updates as any).suiviCommande || content.suiviCommande,
            monture: (updates as any).monture || content.monture,
            verres: (updates as any).verres || content.verres,
            montage: (updates as any).montage || content.montage,
            produits: (updates as any).produits || content.produits
        };

        // Remove undefined keys to avoid overriding with nulls if not provided in partial update
        Object.keys(structuredContent).forEach(key => {
            if (structuredContent[key] === undefined) {
                delete structuredContent[key];
            }
        });

        if (Object.keys(structuredContent).length > 0) {
            payload.content = structuredContent;
        }

        console.log('📤 [FicheService] Final Update Payload:', JSON.stringify(payload, null, 2));

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
