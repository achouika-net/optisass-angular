import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Client, ClientCreate, TypeClient, TitreClient, StatutClient, TypePieceIdentite, TypeCouverture, CorrectionVisuelle, DureePort, ClientParticulier, ClientProfessionnel } from '../models/client.model';

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
            'numeroPieceIdentite' in c &&
            c.numeroPieceIdentite === cin
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
                'numeroPieceIdentite' in c &&
                c.numeroPieceIdentite.toLowerCase().includes(filters.cin!.toLowerCase())
            );
        }

        return of(results).pipe(delay(300));
    }

    /**
     * Initialiser des données de test
     */
    private initMockData(): void {
        this.nextId = 4;
        this.clients = [
            {
                id: '1',
                typeClient: TypeClient.PARTICULIER,
                titre: TitreClient.MME,
                nom: 'Benami',
                prenom: 'Salma',
                dateNaissance: new Date('1990-05-15'),
                typePieceIdentite: TypePieceIdentite.CIN,
                numeroPieceIdentite: 'AA123456',
                telephone: '0612345678',
                email: 'salma.benami@example.com',
                ville: 'Casablanca',
                adresse: '123 Boulevard Anfa, Résidence Les Fleurs, Apt 4',
                statut: StatutClient.ACTIF,
                dateCreation: new Date('2024-01-10'),
                derniereVisite: new Date('2024-10-20'),
                pointsFidelite: 120,
                couvertureSociale: {
                    actif: true,
                    type: TypeCouverture.MUTUELLE,
                    numeroAdhesion: 'MAF-888999'
                },
                groupeFamille: {
                    role: 'Principal', // Test Principal logic
                    nomFamille: 'Famille Benami',
                    beneficiaireOptique: true,
                    responsableFinancier: true,
                    mutuellePartagee: true,
                    adressePartagee: true
                },
                dossierMedical: {
                    correctionActuelle: CorrectionVisuelle.LUNETTES,
                    dureePort: DureePort.ENTRE_1_ET_5_ANS,
                    traumatisme: false,
                    operation: false,
                    inflammation: false,
                    sensibiliteLumiere: true,
                    secheresse: false,
                    antecedentsFamiliaux: {
                        glaucome: false,
                        dmla: false,
                        diabete: true,
                        autres: 'Mère diabétique'
                    },
                    ecranPlus4h: true,
                    ressenti: {
                        fatigue: true,
                        mauxTete: true,
                        visionFloue: false,
                        picotements: false,
                        difficultePresLoin: false
                    },
                    notes: 'Patiente sensible à la lumière bleue.'
                }
            } as any, // Cast as any to avoid strict type checks on partial updates during dev
            {
                id: '2',
                typeClient: TypeClient.PROFESSIONNEL,
                raisonSociale: 'OptiTech Solutions',
                identifiantFiscal: 'IF123456',
                ice: 'ICE987654321',
                registreCommerce: 'RC555666',
                patente: 'P12345',
                telephone: '0522112233',
                email: 'contact@optitech.com',
                ville: 'Rabat',
                adresse: 'Zone Industrielle Agdal',
                statut: StatutClient.ACTIF,
                dateCreation: new Date('2023-11-05'),
                tvaAssujetti: true,
                numeroAutorisation: 'AUT-TVA-2023',
                convention: {
                    actif: true,
                    nomConvention: 'Convention Tech 2024',
                    modalitePaiement: 'Virement',
                    echeancePaiement: '60 jours'
                },
                contacts: [
                    {
                        nom: 'Alami',
                        prenom: 'Karim',
                        fonction: 'Directeur',
                        telephone: '0661112233',
                        email: 'k.alami@optitech.com'
                    },
                    {
                        nom: 'Idrissi',
                        prenom: 'Leila',
                        fonction: 'RH',
                        telephone: '0661112244',
                        email: 'l.idrissi@optitech.com'
                    }
                ]
            } as any,
            {
                id: '3',
                typeClient: TypeClient.PARTICULIER,
                titre: TitreClient.ENF,
                nom: 'Benami',
                prenom: 'Youssef',
                dateNaissance: new Date('2015-06-01'),
                typePieceIdentite: TypePieceIdentite.CIN, // N/A normally but needed for mock
                numeroPieceIdentite: '',
                telephone: '',
                ville: 'Casablanca',
                statut: StatutClient.ACTIF,
                groupeFamille: {
                    role: 'Membre',
                    lienParental: 'Enfant',
                    nomFamille: 'Famille Benami',
                    beneficiaireOptique: true,
                    responsableFinancier: false,
                    mutuellePartagee: true,
                    adressePartagee: true
                },
                dossierMedical: {}
            } as any
        ];
    }
}
