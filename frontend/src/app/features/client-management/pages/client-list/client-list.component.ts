import { Component, OnInit, OnDestroy, signal, NgZone, ChangeDetectorRef, computed } from '@angular/core';
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
import { Router, RouterModule } from '@angular/router';
import { ClientManagementService } from '../../services/client.service';
import { Client, StatutClient, TypeClient, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MessagingService, MessageType } from '../../../../core/services/messaging.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

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
        RouterModule,
    ],
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.css'
})
export class ClientListComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    searchForm: FormGroup;
    stats = signal<ClientStats>({ actifs: 0, enCompte: 0, passage: 0, inactifs: 0 });
    clients = signal<Client[]>([]);

    // Pagination state
    pageSize = signal(10);
    pageIndex = signal(0);
    totalItems = 0;

    // Paginated data for display
    paginatedClients = computed(() => {
        const start = this.pageIndex() * this.pageSize();
        const end = start + this.pageSize();
        return this.clients().slice(start, end);
    });

    displayedColumns: string[] = ['dateCreation', 'titre', 'nom', 'prenom', 'telephone', 'cin', 'ville', 'statut', 'actions'];

    clientTypes = [
        { label: 'Particulier', value: TypeClient.PARTICULIER },
        { label: 'Professionnel', value: TypeClient.PROFESSIONNEL },
        { label: 'Client de passage', value: TypeClient.ANONYME }
    ];

    statuts = [
        { label: 'Actif', value: StatutClient.ACTIF },
        { label: 'Inactif', value: StatutClient.INACTIF },
        { label: 'En compte', value: StatutClient.EN_COMPTE },
        { label: 'De passage', value: StatutClient.DE_PASSAGE }
    ];

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private clientService: ClientManagementService,
        private snackBar: MatSnackBar,
        private zone: NgZone,
        private cdr: ChangeDetectorRef,
        private messagingService: MessagingService
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
        this.setupAutoSearch();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private setupAutoSearch() {
        // Écouter les changements sur tous les champs de recherche
        this.searchForm.valueChanges.pipe(
            debounceTime(500), // Attendre 500ms après la dernière frappe
            distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
            takeUntil(this.destroy$)
        ).subscribe(values => {
            // Vérifier si au moins un champ a 2+ caractères
            const hasMinChars = Object.values(values).some(val =>
                typeof val === 'string' && val.length >= 2
            );

            if (hasMinChars) {
                this.onSearch();
            } else if (this.isFormEmpty(values)) {
                // Si tous les champs sont vides, recharger tous les clients
                this.loadClients();
            }
        });
    }

    private isFormEmpty(values: any): boolean {
        return Object.values(values).every(val => !val || val === '');
    }

    loadStats() {
        console.time('📊 [Stats] Card Loading');
        // TODO: Implement backend endpoint for stats or calculate from list
        // For now, we initialize with 0
        this.stats.set({
            actifs: 0,
            enCompte: 0,
            passage: 0,
            inactifs: 0
        });
        console.timeEnd('📊 [Stats] Card Loading');
    }

    loadClients() {
        console.time('👥 [Clients] Total Load Time');
        this.clientService.getClients().subscribe({
            next: (data) => {
                console.time('👥 [Clients] Zone Run & Rendering');
                this.zone.run(() => {
                    this.clients.set(data);
                    this.totalItems = data.length;
                    this.updateStats(data);
                    this.cdr.markForCheck();
                    this.cdr.detectChanges();
                });
                console.timeEnd('👥 [Clients] Zone Run & Rendering');
                console.timeEnd('👥 [Clients] Total Load Time');
            },
            error: (err) => {
                console.timeEnd('👥 [Clients] Total Load Time');
                console.error('Error loading clients', err);
            }
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
        this.pageSize.set(event.pageSize);
        this.pageIndex.set(event.pageIndex);
        this.cdr.markForCheck();
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
        // Direct access to titre if it exists (handles both Particulier and imported data)
        const titre = (client as any).titre;
        if (titre) return titre;

        if (isClientProfessionnel(client)) {
            return 'Prof';
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

    sendMessage(client: Client, type: MessageType) {
        if (!client.telephone) {
            this.snackBar.open('Ce client n\'a pas de numéro de téléphone', 'Fermer', { duration: 3000 });
            return;
        }

        const clientName = this.getClientName(client);
        const clientPrenom = this.getClientPrenom(client);
        const fullName = clientPrenom !== '-' ? `${clientName} ${clientPrenom}` : clientName;

        this.messagingService.openWhatsApp(client.telephone, type, { name: fullName });
    }
}
