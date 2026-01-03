import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductService } from '../../../stock-management/services/product.service';
import { ClientManagementService } from '../../services/client.service';
import { MarketingService } from '../../services/marketing.service';
import { Product, ProductType } from '../../../../shared/interfaces/product.interface';
import { Client } from '../../models/client.model';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'app-promotion-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatTableModule,
        MatDividerModule,
        MatProgressBarModule
    ],
    templateUrl: './promotion-management.component.html',
    styleUrls: ['./promotion-management.component.scss']
})
export class PromotionManagementComponent implements OnInit {
    // Signals for state management
    products = signal<Product[]>([]);
    clients = signal<Client[]>([]);
    loading = signal(false);

    // Filters
    filterType = signal<string>('');
    filterMarque = signal<string>('');
    filterDaysInStock = signal<number>(180); // Default 6 months

    // Selection
    selectedProducts = signal<string[]>([]);
    selectedClients = signal<string[]>([]);

    // Campaign content
    messageTemplate = signal('Profitez de notre offre exceptionnelle sur les produits {{MARQUE}} !');

    // Computed lists
    filteredProducts = computed(() => {
        const list = this.products();
        const type = this.filterType();
        const marque = this.filterMarque() ? this.filterMarque().toLowerCase() : '';
        const days = this.filterDaysInStock();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return list.filter(p => {
            const matchType = !type || p.typeArticle === type;
            const matchMarque = !marque || p.marque?.toLowerCase().includes(marque);
            const matchDate = !days || new Date(p.dateCreation) <= cutoffDate;
            const hasStock = p.quantiteActuelle > 0;
            return matchType && matchMarque && matchDate && hasStock;
        });
    });

    constructor(
        private productService: ProductService,
        private clientService: ClientManagementService,
        private marketingService: MarketingService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading.set(true);
        forkJoin({
            products: this.productService.findAll({ global: true }),
            clients: this.clientService.getClients()
        }).subscribe({
            next: (res) => {
                this.products.set(res.products);
                this.clients.set(res.clients);
                // By default, select all clients
                this.selectedClients.set(res.clients.map(c => c.id));
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading data:', err);
                this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
                this.loading.set(false);
            }
        });
    }

    toggleProduct(id: string): void {
        const current = this.selectedProducts();
        if (current.includes(id)) {
            this.selectedProducts.set(current.filter(i => i !== id));
        } else {
            this.selectedProducts.set([...current, id]);
        }
    }

    selectAllProducts(): void {
        const allIds = this.filteredProducts().map(p => p.id!);
        this.selectedProducts.set(allIds);
    }

    launchCampaign(): void {
        const clientIds = this.selectedClients();
        const productIds = this.selectedProducts();
        const template = this.messageTemplate();

        if (clientIds.length === 0) {
            this.snackBar.open('Veuillez sélectionner au moins un client', 'Fermer', { duration: 3000 });
            return;
        }

        if (productIds.length === 0) {
            this.snackBar.open('Veuillez sélectionner au moins un produit', 'Fermer', { duration: 3000 });
            return;
        }

        this.loading.set(true);
        this.marketingService.launchCampaign({
            clientIds,
            productIds,
            template
        }).subscribe({
            next: (res) => {
                this.snackBar.open(`Campagne lancée avec succès : ${res.totalSent} messages envoyés.`, 'Super !', { duration: 5000 });
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error launching campaign:', err);
                this.snackBar.open('Erreur lors du lancement de la campagne', 'Fermer', { duration: 3000 });
                this.loading.set(false);
            }
        });
    }
}
