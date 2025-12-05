import { Component, OnInit, signal } from '@angular/core';
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
import { Router } from '@angular/router';

interface ClientStats {
    actifs: number;
    enCompte: number;
    passage: number;
    inactifs: number;
}

interface Client {
    id: string;
    type: string;
    nom: string;
    prenom: string;
    telephone: string;
    cin: string;
    ville: string;
    statut: 'Actif' | 'Inactif' | 'En compte' | 'De passage';
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
    ],
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.css'
})
export class ClientListComponent implements OnInit {
    searchForm: FormGroup;
    stats = signal<ClientStats>({ actifs: 1, enCompte: 0, passage: 0, inactifs: 0 });
    clients = signal<Client[]>([]);
    displayedColumns: string[] = ['type', 'nom', 'prenom', 'telephone', 'cin', 'ville', 'statut', 'actions'];

    pageSize = 5;
    pageIndex = 0;
    totalItems = 0;

    clientTypes = ['Particulier', 'Professionnel', 'Anonyme'];
    statuts = ['Actif', 'Inactif', 'En compte', 'De passage'];

    constructor(
        private fb: FormBuilder,
        private router: Router
    ) {
        this.searchForm = this.fb.group({
            typeClient: [''],
            statut: [''],
            nom: [''],
            prenom: [''],
            telephone: [''],
            cin: [''],
            ville: ['']
        });
    }

    ngOnInit() {
        this.loadClients();
        this.loadStats();
    }

    loadStats() {
        // Simuler le chargement des statistiques
        this.stats.set({
            actifs: 1,
            enCompte: 0,
            passage: 0,
            inactifs: 0
        });
    }

    loadClients() {
        // Simuler le chargement des clients
        const mockClients: Client[] = [
            {
                id: '1',
                type: 'Particulier',
                nom: 'Doe',
                prenom: 'John',
                telephone: '0600000000',
                cin: 'AB123456',
                ville: 'Casablanca',
                statut: 'Actif'
            }
        ];

        this.clients.set(mockClients);
        this.totalItems = mockClients.length;
    }

    onSearch() {
        console.log('Recherche:', this.searchForm.value);
        this.loadClients();
    }

    onPageChange(event: PageEvent) {
        this.pageSize = event.pageSize;
        this.pageIndex = event.pageIndex;
        this.loadClients();
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
}
