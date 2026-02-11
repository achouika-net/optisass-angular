import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';
import { Client, ClientCreate, TypeClient, TitreClient, StatutClient, TypePieceIdentite, TypeCouverture, CorrectionVisuelle, DureePort, ClientParticulier, ClientProfessionnel } from '../models/client.model';
import { API_URL } from '@app/config';

@Injectable({
    providedIn: 'root'
})
export class ClientManagementService {
    private apiUrl = `${API_URL}/clients`;

    constructor(private http: HttpClient) { }

    /**
     * Map backend response to frontend model
     * Backend uses 'civilite', frontend uses 'titre'
     */
    private mapBackendResponse(client: any): Client {
        const mapped = client && client.civilite ? { ...client, titre: client.civilite } : { ...client };
        if (mapped.typeClient) {
            mapped.typeClient = mapped.typeClient.toLowerCase();
        }
        return mapped;
    }

    /**
     * Récupérer tous les clients
     */
    getClients(nom?: string): Observable<Client[]> {
        const params: any = {};
        if (nom) params.nom = nom;
        return this.http.get<any[]>(this.apiUrl, { params }).pipe(
            map(clients => clients.map(c => this.mapBackendResponse(c)))
        );
    }

    searchClientsByNom(nom: string): Observable<Client[]> {
        return this.getClients(nom);
    }

    /**
     * Récupérer un client par ID
     */
    getClient(id: string): Observable<Client | undefined> {
        return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
            map(client => this.mapBackendResponse(client))
        );
    }

    /**
     * Créer un nouveau client
     */
    createClient(clientData: ClientCreate): Observable<Client> {
        // Validation CIN unique via Backend (simulation via getClients pour l'instant ou gestion erreur backend)
        // Pour l'instant on laisse le backend gérer l'unicité ou on fait une pré-vérification
        if (clientData.typeClient === TypeClient.PARTICULIER && 'cin' in clientData) {
            return this.verifyCinUnique(clientData.cin as string).pipe(
                switchMap(isUnique => {
                    if (!isUnique) {
                        return throwError(() => new Error('Un client avec ce CIN existe déjà'));
                    }
                    return this.http.post<Client>(this.apiUrl, clientData);
                })
            );
        }
        return this.http.post<Client>(this.apiUrl, clientData);
    }

    /**
     * Mettre à jour un client existant
     */
    updateClient(id: string, clientData: Partial<Client>): Observable<Client> {
        if (clientData.typeClient === TypeClient.PARTICULIER && 'numeroPieceIdentite' in clientData) {
            return this.verifyCinUnique((clientData as any).numeroPieceIdentite!, id).pipe(
                switchMap(isUnique => {
                    if (!isUnique) {
                        return throwError(() => new Error('Un client avec ce CIN existe déjà'));
                    }
                    return this.http.put<Client>(`${this.apiUrl}/${id}`, clientData);
                })
            );
        }
        return this.http.put<Client>(`${this.apiUrl}/${id}`, clientData);
    }

    /**
     * Supprimer un client
     */
    deleteClient(id: string): Observable<boolean> {
        return this.http.delete<boolean>(`${this.apiUrl}/${id}`);
    }

    /**
     * Vérifier si un CIN est unique
     * Note: Idéalement, créer un endpoint backend dédié /clients/check-cin
     */
    verifyCinUnique(cin: string, excludeId?: string): Observable<boolean> {
        return this.getClients().pipe(
            map(clients => {
                const exists = clients.some(c =>
                    c.id !== excludeId &&
                    c.typeClient === TypeClient.PARTICULIER &&
                    'numeroPieceIdentite' in c &&
                    c.numeroPieceIdentite === cin
                );
                return !exists;
            })
        );
    }

    /**
     * Rechercher des clients selon des critères
     * Utilise le backend pour filtrer directement dans la base de données
     */
    searchClients(filters: {
        typeClient?: TypeClient;
        statut?: StatutClient;
        nom?: string;
        prenom?: string;
        telephone?: string;
        groupeFamille?: string;
        cin?: string;
    }): Observable<Client[]> {
        // Construire les paramètres de requête
        let params: any = {};

        if (filters.typeClient) params.typeClient = filters.typeClient;
        if (filters.statut) params.statut = filters.statut;
        if (filters.nom) params.nom = filters.nom;
        if (filters.prenom) params.prenom = filters.prenom;
        if (filters.telephone) params.telephone = filters.telephone;
        if (filters.cin) params.cin = filters.cin;
        if (filters.groupeFamille) params.groupeFamille = filters.groupeFamille;

        return this.http.get<any[]>(`${this.apiUrl}/search`, { params }).pipe(
            map(clients => clients.map(c => this.mapBackendResponse(c)))
        );
    }
}

