import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Client, ClientCreate, TypeClient } from '../models/client.model';

@Injectable({
    providedIn: 'root'
})
export class ClientService {
    // Mock data storage (sera remplacé par des appels HTTP)
    private clients: Client[] = [];
    private nextId = 1;

    constructor() {
        // Initialiser avec quelques données de test
        this.initMockData();
    }

    /**
     * Récupérer tous les clients
     */
    getClients(): Observable<Client[]> {
        return of([...this.clients]).pipe(delay(300));
    }

    /**
     * Récupérer un client par ID
     */
    getClient(id: string): Observable<Client | undefined> {
        const client = this.clients.find(c => c.id === id);
        return of(client).pipe(delay(200));
    }

    /**
     * Créer un nouveau client
     */
    createClient(clientData: ClientCreate): Observable<Client> {
        // Vérifier l'unicité du CIN pour les clients particuliers
        if (clientData.typeClient === TypeClient.PARTICULIER && 'cin' in clientData) {
            const cinExists = this.clients.some(c =>
                c.typeClient === TypeClient.PARTICULIER &&
                'cin' in c &&
                c.cin === clientData.cin
            );

            if (cinExists) {
                return throwError(() => new Error('Un client avec ce CIN existe déjà'));
            }
        }

        const newClient: Client = {
            ...clientData,
            id: String(this.nextId++),
            dateCreation: new Date(),
            pointsFidelite: 0
        } as Client;

        this.clients.push(newClient);
        return of(newClient).pipe(delay(300));
    }

    /**
     * Mettre à jour un client existant
     */
    updateClient(id: string, clientData: Partial<Client>): Observable<Client> {
        const index = this.clients.findIndex(c => c.id === id);

        if (index === -1) {
            return throwError(() => new Error('Client non trouvé'));
        }

        // Vérifier l'unicité du CIN si modifié
        if (clientData.typeClient === TypeClient.PARTICULIER && 'cin' in clientData) {
            const cinExists = this.clients.some(c =>
                c.id !== id &&
                c.typeClient === TypeClient.PARTICULIER &&
                'cin' in c &&
                c.cin === (clientData as any).cin
            );

            if (cinExists) {
                return throwError(() => new Error('Un client avec ce CIN existe déjà'));
            }
        }

        this.clients[index] = {
            ...this.clients[index],
            ...clientData
        } as Client;

        return of(this.clients[index]).pipe(delay(300));
    }

    /**
     * Supprimer un client
     */
    deleteClient(id: string): Observable<boolean> {
        const index = this.clients.findIndex(c => c.id === id);

        if (index === -1) {
            return throwError(() => new Error('Client non trouvé'));
        }

        this.clients.splice(index, 1);
        return of(true).pipe(delay(200));
    }

    /**
     * Vérifier si un CIN est unique
     */
    verifyCinUnique(cin: string, excludeId?: string): Observable<boolean> {
        const exists = this.clients.some(c =>
            c.id !== excludeId &&
            c.typeClient === TypeClient.PARTICULIER &&
            'cin' in c &&
            c.cin === cin
        );

        return of(!exists).pipe(delay(200));
    }

    /**
     * Rechercher des clients selon des critères
     */
    searchClients(filters: {
        typeClient?: TypeClient;
        nom?: string;
        telephone?: string;
        ville?: string;
        cin?: string;
    }): Observable<Client[]> {
        let results = [...this.clients];

        if (filters.typeClient) {
            results = results.filter(c => c.typeClient === filters.typeClient);
        }

        if (filters.nom) {
            results = results.filter(c => {
                if (c.typeClient === TypeClient.PARTICULIER && 'nom' in c) {
                    return c.nom.toLowerCase().includes(filters.nom!.toLowerCase());
                }
                if (c.typeClient === TypeClient.PROFESSIONNEL && 'raisonSociale' in c) {
                    return c.raisonSociale.toLowerCase().includes(filters.nom!.toLowerCase());
                }
                return false;
            });
        }

        if (filters.telephone) {
            results = results.filter(c =>
                c.telephone?.includes(filters.telephone!)
            );
        }

        if (filters.ville) {
            results = results.filter(c =>
                c.ville?.toLowerCase().includes(filters.ville!.toLowerCase())
            );
        }

        if (filters.cin) {
            results = results.filter(c =>
                c.typeClient === TypeClient.PARTICULIER &&
                'cin' in c &&
                c.cin.includes(filters.cin!)
            );
        }

        return of(results).pipe(delay(300));
    }

    /**
     * Initialiser des données de test
     */
    private initMockData(): void {
        // Cette méthode sera supprimée quand on connectera au backend
        this.clients = [];
        this.nextId = 1;
    }
}
