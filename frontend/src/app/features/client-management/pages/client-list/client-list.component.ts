import {
    Component, OnInit, OnDestroy, signal, NgZone, ChangeDetectorRef,
    ViewChild, effect, AfterViewInit, inject, Injector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterModule } from '@angular/router';
import { ClientManagementService } from '../../services/client.service';
import { Client, StatutClient, TypeClient, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MessagingService, MessageType } from '../../../../core/services/messaging.service';
import { Subject } from 'rxjs';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
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
        MatSlideToggleModule,
        MatProgressSpinnerModule,
        RouterModule,
    ],
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.css'
})
export class ClientListComponent implements OnInit, AfterViewInit, OnDestroy {
    private destroy$ = new Subject<void>();
    private injector = inject(Injector);

    searchForm: FormGroup;
    loading = signal(false);
    stats = signal<ClientStats>({ actifs: 0, enCompte: 0, passage: 0, inactifs: 0 });
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    // Pagination state – server-side
    pageSize = 10;
    pageIndex = 0;
    totalItems = 0;
    dataSource = new MatTableDataSource<Client>([]);

    @ViewChild(MatPaginator) paginator!: MatPaginator;

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
        private messagingService: MessagingService,
        private store: Store
    ) {
        this.searchForm = this.fb.group({
            typeClient: [''],
            statut: [''],
            nom: [''],
            prenom: [''],
            telephone: [''],
            cin: [''],
            groupeFamille: [''],
            fidelioEligible: [false]
        });

        // ✅ effect() MUST be in the constructor (injection context)
        effect(() => {
            const center = this.currentCentre() as any;
            if (center && center.id) {
                // Reload when centre changes – runs inside injection context correctly
                this.loadClients();
            }
        }, { injector: this.injector });
    }

    ngOnInit() {
        this.loadClients();
        this.setupAutoSearch();
    }

    ngAfterViewInit() {
        // ✅ Wire paginator AFTER view is initialized so mat-paginator is available
        if (this.paginator) {
            this.dataSource.paginator = this.paginator;
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private setupAutoSearch() {
        this.searchForm.valueChanges.pipe(
            debounceTime(500),
            distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
            takeUntil(this.destroy$)
        ).subscribe(values => {
            const hasMinChars = Object.values(values).some(val =>
                typeof val === 'string' && val.length >= 2
            );

            if (hasMinChars) {
                this.pageIndex = 0; // reset page on new search
                this.onSearch();
            } else if (this.isFormEmpty(values)) {
                this.pageIndex = 0;
                this.loadClients();
            }
        });
    }

    private isFormEmpty(values: any): boolean {
        return Object.values(values).every(val => !val || val === '');
    }

    loadClients() {
        this.loading.set(true);
        this.clientService.getClients().subscribe({
            next: (data) => {
                this.zone.run(() => {
                    this.totalItems = data.length;
                    this.dataSource.data = data;

                    // Ensure paginator is wired
                    if (this.paginator && !this.dataSource.paginator) {
                        this.dataSource.paginator = this.paginator;
                    }
                    if (this.paginator) {
                        this.paginator.length = data.length;
                    }

                    this.updateStats(data);
                    this.loading.set(false);
                    this.cdr.markForCheck();
                    this.cdr.detectChanges();
                });
            },
            error: (err) => {
                this.loading.set(false);
                console.error('Error loading clients', err);
            }
        });
    }

    updateStats(clients: Client[]) {
        const stats = {
            actifs: clients.filter(c => c.statut?.toString()?.toUpperCase() === 'ACTIF').length,
            enCompte: clients.filter(c => c.statut?.toString()?.toUpperCase() === 'EN_COMPTE').length,
            passage: clients.filter(c => c.statut?.toString()?.toUpperCase() === 'DE_PASSAGE').length,
            inactifs: clients.filter(c => c.statut?.toString()?.toUpperCase() === 'INACTIF').length
        };
        this.stats.set(stats);
    }

    deleteClient(client: Client) {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le client ${this.getClientName(client)} ${this.getClientPrenom(client)} ?\nCette action est irréversible.`)) {
            this.clientService.deleteClient(client.id).subscribe({
                next: () => {
                    this.snackBar.open('Client supprimé avec succès', 'Fermer', { duration: 3000 });
                    this.loadClients();
                },
                error: (err: any) => {
                    const msg = err.error?.message || 'Erreur lors de la suppression du client';
                    this.snackBar.open(msg, 'Fermer', { duration: 5000 });
                }
            });
        }
    }

    onSearch() {
        const criteria = this.searchForm.value;
        this.loading.set(true);
        this.clientService.searchClients(criteria).subscribe({
            next: (data) => {
                this.zone.run(() => {
                    this.totalItems = data.length;
                    this.dataSource.data = data;
                    if (this.paginator) {
                        this.dataSource.paginator = this.paginator;
                        this.paginator.length = data.length;
                        this.paginator.firstPage();
                    }
                    this.updateStats(data);
                    this.loading.set(false);
                    this.cdr.markForCheck();
                    this.cdr.detectChanges();
                });
            },
            error: (err) => {
                this.loading.set(false);
                console.error('Error searching clients', err);
            }
        });
    }

    onPageChange(event: PageEvent) {
        this.pageSize = event.pageSize;
        this.pageIndex = event.pageIndex;
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
    }

    // Helper methods for display
    getClientName(client: Client): string {
        if (isClientProfessionnel(client)) {
            return client.raisonSociale || '-';
        }
        if (isClientParticulier(client)) {
            return client.nom || '-';
        }
        return (client as any).nom || '-';
    }

    getClientPrenom(client: Client): string {
        if (isClientProfessionnel(client)) {
            return '-';
        }
        if (isClientParticulier(client)) {
            return client.prenom || '-';
        }
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
        if (typeClient === 'particulier') return 'Particulier';
        if (typeClient === 'professionnel') return 'Professionnel';
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
