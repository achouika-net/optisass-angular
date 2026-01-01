import { Component, OnInit, signal, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { ClientManagementService } from '../../services/client.service';
import { Client, StatutClient, TypeClient, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ClientStats {
    actifs: number;
    enCompte: number;
    passage: number;
    inactifs: number;
}

@Component({
    selector: 'app-client-list',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatTableModule,
        MatPaginatorModule,
        MatIconModule,
        MatMenuModule,
        MatDividerModule,
    ],
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.css'
})
export class ClientListComponent implements OnInit {
    searchForm: FormGroup;
    stats = signal<ClientStats>({ actifs: 0, enCompte: 0, passage: 0, inactifs: 0 });
    clients = signal<Client[]>([]);
    displayedColumns: string[] = ['type', 'titre', 'nom', 'prenom', 'telephone', 'cin', 'ville', 'statut', 'actions'];

    pageSize = 10;
    pageIndex = 0;
    totalItems = 0;

    clientTypes = ['Particulier', 'Professionnel', 'Client de passage'];
    statuts = ['Actif', 'Inactif', 'En compte', 'De passage'];

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private clientService: ClientManagementService,
        private snackBar: MatSnackBar,
        private zone: NgZone
    ) {
        this.searchForm = this.fb.group({
            typeClient: [''],
            statut: [''],
            nom: [''],
            prenom: [''],
            telephone: [''],
            cin: [''],
            groupeFamille: ['']
        });
    }

    ngOnInit() {
        this.loadClients();
        this.loadStats();
    }

    loadStats() {
        // TODO: Implement backend endpoint for stats or calculate from list
        // For now, we initialize with 0
        this.stats.set({
            actifs: 0,
            enCompte: 0,
            passage: 0,
            inactifs: 0
        });
    }

    loadClients() {
        this.clientService.getClients().subscribe({
            next: (data) => {
                this.zone.run(() => {
                    this.clients.set(data);
                    this.totalItems = data.length;
                    this.updateStats(data);
                });
            },
            error: (err) => console.error('Error loading clients', err)
        });
    }

    updateStats(clients: Client[]) {
        const stats = {
            actifs: clients.filter(c => c.statut === StatutClient.ACTIF).length,
            enCompte: clients.filter(c => c.statut === StatutClient.EN_COMPTE).length,
            passage: clients.filter(c => c.statut === StatutClient.DE_PASSAGE).length,
            inactifs: clients.filter(c => c.statut === StatutClient.INACTIF).length
        };
        this.stats.set(stats);
    }

    deleteClient(client: Client) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le client ${this.getClientName(client)} ${this.getClientPrenom(client)} ? \nCette action est irréversible et supprimera tout l'historique non bloquant.`)) {
            this.clientService.deleteClient(client.id).subscribe({
                next: () => {
                    this.snackBar.open('Client supprimé avec succès', 'Fermer', { duration: 3000 });
                    this.loadClients();
                },
                error: (err: any) => {
                    console.error('Error deleting client', err);
                    // Display backend error message if available
                    const msg = err.error?.message || 'Erreur lors de la suppression du client';
                    this.snackBar.open(msg, 'Fermer', { duration: 5000 });
                }
            });
        }
    }

    onSearch() {
        const criteria = this.searchForm.value;
        // Basic filtered list from loaded clients (Client-side filtering for now)
        // OR better: use clientService.searchClients(criteria)
        this.clientService.searchClients(criteria).subscribe({
            next: (data) => {
                this.clients.set(data);
                this.totalItems = data.length;
            },
            error: (err) => console.error('Error searching clients', err)
        });
    }

    onPageChange(event: PageEvent) {
        this.pageSize = event.pageSize;
        this.pageIndex = event.pageIndex;
        // Implement backend pagination if supported
        // For now, simple refresh or slice if we had full list logic (but clients uses full list)
    }

    viewClient(client: Client) {
        this.router.navigate(['/p/clients', client.id]);
    }

    editClient(client: Client) {
        this.router.navigate(['/p/clients', client.id, 'edit']);
    }

    addClient() {
        this.router.navigate(['/p/clients/new']);
    }

    exportClients() {
        console.log('Export des clients');
        // TODO: Implémenter l'export
    }

    // Helper methods for display
    getClientName(client: Client): string {
        if (isClientProfessionnel(client)) {
            return client.raisonSociale || '-';
        }
        if (isClientParticulier(client)) {
            return client.nom || '-';
        }
        // For anonyme clients
        return (client as any).nom || '-';
    }

    getClientPrenom(client: Client): string {
        if (isClientProfessionnel(client)) {
            return '-';
        }
        if (isClientParticulier(client)) {
            return client.prenom || '-';
        }
        // For anonyme clients
        return (client as any).prenom || '-';
    }

    getPieceIdentite(client: Client): string {
        if (isClientProfessionnel(client)) {
            return client.registreCommerce || '-';
        }
        if (isClientParticulier(client)) {
            const particulier = client as any;
            if (particulier.titre === 'Enf') {
                return particulier.cinParent || '-';
            }
            return particulier.numeroPieceIdentite || '-';
        }
        return '-';
    }

    getClientTitle(client: Client): string {
        if (isClientProfessionnel(client)) {
            return 'Prof';
        }
        const typeStr = typeof client.typeClient === 'string' ? client.typeClient.toLowerCase() : '';
        if (typeStr === 'anonyme' || client.typeClient === TypeClient.ANONYME) {
            return 'Client';
        }
        if (isClientParticulier(client)) {
            return (client as any).titre || '-';
        }
        return '-';
    }

    getTypeLabel(typeClient: string): string {
        if (typeClient === 'anonyme' || typeClient === TypeClient.ANONYME) {
            return 'Client de passage';
        }
        if (typeClient === 'particulier') {
            return 'Particulier';
        }
        if (typeClient === 'professionnel') {
            return 'Professionnel';
        }
        return typeClient;
    }
}
