import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ProductService } from '../../../stock-management/services/product.service';
import { Product, ProductType } from '../../../../shared/interfaces/product.interface';
import { ClientManagementService } from '../../../client-management/services/client.service';
import { MarketingService } from '../../../client-management/services/marketing.service';
import { Client } from '../../../client-management/models/client.model';

interface PromotionRule {
    type: 'MARQUE' | 'PRODUIT' | 'CATEGORIE';
    target: string;
    remise: number;
}

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
        MatTableModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTabsModule,
        MatDividerModule,
        MatButtonToggleModule
    ],
    templateUrl: './promotion-management.component.html',
    styleUrls: ['./promotion-management.component.scss']
})
export class PromotionManagementComponent implements OnInit {
    private productService = inject(ProductService);
    private clientService = inject(ClientManagementService);
    private marketingService = inject(MarketingService);
    private snackBar = inject(MatSnackBar);

    // Concept de Promotion
    promotionName = signal<string>('Soldes d\'Hiver 2026');
    promotionDescription = signal<string>('Offre exceptionnelle sur tout le vieux stock');

    // Paramètres Durée Stock (vieux stock)
    stockAgeLimitDays = signal<number>(180); // 6 mois par défaut

    // Règles de Remises
    rules = signal<PromotionRule[]>([]);
    newRule = signal<PromotionRule>({ type: 'MARQUE', target: '', remise: 10 });

    // Données
    products = signal<Product[]>([]);
    clients = signal<Client[]>([]);
    loading = signal<boolean>(false);

    // Filtres UI
    filterBrand = signal<string>('');
    filterType = signal<string>('');
    productSearch = signal<string>('');
    onlyOldStock = signal<boolean>(true);

    // Selections
    selectedProducts = signal<Product[]>([]);
    selectedClients = signal<Client[]>([]);

    // Relances & Canaux
    selectedChannel = signal<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');

    // Messages
    messageTemplate = signal<string>('Bonjour {{NAME}}, profitez de notre Offre Spéciale ! Bénéficiez d\'une remise exceptionnelle sur le modèle {{PRODUCT}} ({{MARQUE}}). Venez nous voir en magasin !');

    // Computed data
    filteredProducts = computed(() => {
        let list = this.products();

        // Filtre Ancienneté (Optionnel)
        if (this.onlyOldStock() && this.stockAgeLimitDays() > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - this.stockAgeLimitDays());
            // Utiliser dateCreation (mappé depuis createdAt par mon loadData ou backend)
            list = list.filter(p => p.dateCreation && new Date(p.dateCreation) <= cutoff);
        }

        // Filtre Recherche
        if (this.productSearch()) {
            const s = this.productSearch().toLowerCase();
            list = list.filter(p =>
                p.designation.toLowerCase().includes(s) ||
                p.marque?.toLowerCase().includes(s) ||
                p.codeInterne?.toLowerCase().includes(s)
            );
        }

        if (this.filterBrand()) {
            list = list.filter(p => p.marque?.toLowerCase().includes(this.filterBrand().toLowerCase()));
        }

        if (this.filterType()) {
            list = list.filter(p => p.typeArticle === this.filterType());
        }

        return list;
    });

    brands = computed(() => {
        const b = new Set<string>();
        this.products().forEach(p => { if (p.marque) b.add(p.marque); });
        return Array.from(b).sort();
    });

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.loading.set(true);
        // Utiliser global: true pour s'assurer de voir les produits même sans entrepot spécifique
        this.productService.findAll({ global: true } as any).subscribe({
            next: (data: any[]) => {
                // Mapper createdAt (backend) vers dateCreation (interface frontend) si nécessaire
                const mapped = data.map(p => ({
                    ...p,
                    dateCreation: p.dateCreation || p.createdAt || new Date()
                })) as Product[];

                this.products.set(mapped.filter(p => p.quantiteActuelle > 0));
                this.loading.set(false);
            },
            error: () => {
                this.snackBar.open('Erreur chargement produits', 'Fermer', { duration: 3000 });
                this.loading.set(false);
            }
        });

        this.clientService.getClients().subscribe({
            next: (data: Client[]) => {
                this.clients.set(data);
            }
        });
    }

    addRule() {
        if (!this.newRule().target && this.newRule().type !== 'CATEGORIE') return;
        this.rules.set([...this.rules(), { ...this.newRule() }]);
        this.newRule.set({ type: 'MARQUE', target: '', remise: 10 });
    }

    removeRule(index: number) {
        const r = this.rules();
        r.splice(index, 1);
        this.rules.set([...r]);
    }

    getRemiseForProduct(product: Product): number {
        // Check product specific rule
        const prodRule = this.rules().find(r => r.type === 'PRODUIT' && r.target === product.id);
        if (prodRule) return prodRule.remise;

        // Check brand rule
        const brandRule = this.rules().find(r => r.type === 'MARQUE' && r.target === product.marque);
        if (brandRule) return brandRule.remise;

        // Check category rule
        const catRule = this.rules().find(r => r.type === 'CATEGORIE' && r.target === product.typeArticle);
        if (catRule) return catRule.remise;

        return 0;
    }

    getClientName(client: Client): string {
        if (client.typeClient === 'professionnel') {
            return (client as any).raisonSociale || 'Client Pro';
        }
        const c = client as any;
        return `${c.nom || ''} ${c.prenom || ''}`.trim() || 'Client Anonyme';
    }

    toggleProduct(product: Product) {
        const current = this.selectedProducts();
        const index = current.findIndex(p => p.id === product.id);
        if (index > -1) {
            this.selectedProducts.set(current.filter(p => p.id !== product.id));
        } else {
            this.selectedProducts.set([...current, product]);
        }
    }

    isProductSelected(product: Product): boolean {
        return this.selectedProducts().some(p => p.id === product.id);
    }

    toggleAllClients(event: any) {
        if (event.checked) {
            this.selectedClients.set([...this.clients()]);
        } else {
            this.selectedClients.set([]);
        }
    }

    toggleClient(client: Client) {
        const current = this.selectedClients();
        const index = current.findIndex(c => c.id === client.id);
        if (index > -1) {
            this.selectedClients.set(current.filter(c => c.id !== client.id));
        } else {
            this.selectedClients.set([...current, client]);
        }
    }

    // Segmentation Logic
    selectSegment(segment: 'ALL' | 'ACTIF' | 'INACTIF' | 'BIRTHDAY') {
        const now = new Date();
        let filtered = [...this.clients()];

        if (segment === 'ACTIF') {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(now.getMonth() - 6);
            filtered = filtered.filter(c => c.derniereVisite && new Date(c.derniereVisite) >= sixMonthsAgo);
        } else if (segment === 'INACTIF') {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(now.getFullYear() - 1);
            filtered = filtered.filter(c => !c.derniereVisite || new Date(c.derniereVisite) < oneYearAgo);
        } else if (segment === 'BIRTHDAY') {
            filtered = filtered.filter(c => {
                if (c.typeClient === 'particulier' && (c as any).dateNaissance) {
                    const dob = new Date((c as any).dateNaissance);
                    return dob.getMonth() === now.getMonth();
                }
                return false;
            });
        }

        this.selectedClients.set(filtered);
    }

    launchCampaign() {
        if (this.selectedClients().length === 0 || this.selectedProducts().length === 0) {
            this.snackBar.open('Sélectionnez des produits et des clients', 'Fermer', { duration: 3000 });
            return;
        }

        this.loading.set(true);
        const campaignData = {
            clientIds: this.selectedClients().map(c => c.id!),
            productIds: this.selectedProducts().map(p => p.id!),
            template: this.messageTemplate(),
            promoName: this.promotionName(),
            promoDescription: this.promotionDescription(),
            channel: this.selectedChannel()
        };

        this.marketingService.launchCampaign(campaignData).subscribe({
            next: () => {
                this.snackBar.open('Campagne lancée avec succès', 'Fermer', { duration: 5000 });
                this.loading.set(false);
            },
            error: () => {
                this.snackBar.open('Erreur lors du lancement', 'Fermer', { duration: 3000 });
                this.loading.set(false);
            }
        });
    }
}
