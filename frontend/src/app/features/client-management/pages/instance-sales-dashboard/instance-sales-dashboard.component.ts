import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { InstanceSalesMonitorService, InstanceSale } from '../../services/instance-sales-monitor.service';
import { FactureService } from '../../services/facture.service';
import { ProductService } from '../../../stock-management/services/product.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UpcomingDeliveriesWidgetComponent } from '../../components/upcoming-deliveries-widget/upcoming-deliveries-widget.component';
import { MessagingService } from '../../../../core/services/messaging.service';

@Component({
    selector: 'app-instance-sales-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatMenuModule,
        MatTooltipModule,
        MatDividerModule,
        UpcomingDeliveriesWidgetComponent
    ],
    templateUrl: './instance-sales-dashboard.component.html',
    styleUrls: ['./instance-sales-dashboard.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstanceSalesDashboardComponent implements OnInit {
    instanceSales$: Observable<InstanceSale[]>;
    displayedColumns = ['client', 'numero', 'produits', 'statut', 'montant', 'date', 'actions'];

    constructor(
        public monitor: InstanceSalesMonitorService,
        private factureService: FactureService,
        private productService: ProductService,
        private messagingService: MessagingService,
        private router: Router,
        private snackBar: MatSnackBar
    ) {
        this.instanceSales$ = this.monitor.getInstanceSales();
    }

    ngOnInit(): void {
        // Start polling if not already started
        this.monitor.startPolling();
        // Trigger immediate refresh
        this.monitor.refreshNow();
    }

    getStatusBadge(status: string): { class: string; label: string; icon: string } {
        switch (status) {
            case 'READY':
                return { class: 'status-ready', label: 'Prêt à valider', icon: 'check_circle' };
            case 'IN_TRANSIT':
                return { class: 'status-transit', label: 'En transit', icon: 'local_shipping' };
            case 'CANCELLED':
                return { class: 'status-cancelled', label: 'Annulé', icon: 'cancel' };
            default:
                return { class: 'status-unknown', label: 'Inconnu', icon: 'help' };
        }
    }

    validateSale(sale: InstanceSale): void {
        if (sale.status !== 'READY') {
            this.snackBar.open('Le produit n\'est pas encore reçu', 'OK', { duration: 3000 });
            return;
        }

        const confirm = window.confirm(
            `Voulez-vous valider la vente ${sale.facture.numero} ?\n\n` +
            `Client: ${sale.facture.client?.nom || 'N/A'}\n` +
            `Montant: ${sale.facture.totalTTC} MAD`
        );

        if (!confirm) return;

        // Convert to FACTURE VALIDE
        const updateData = {
            type: 'FACTURE',
            statut: 'VALIDE',
            proprietes: {
                ...(sale.facture.proprietes || {}),
                validatedAt: new Date(),
                isTransferFulfilled: true,
                forceStockDecrement: true // Important to ensure stock is decremented if not already
            }
        } as any;

        this.factureService.update(sale.facture.id, updateData).subscribe({
            next: () => {
                this.snackBar.open('Vente validée avec succès', 'OK', { duration: 3000 });
                this.monitor.clearNotification(sale.facture.id);
                this.monitor.refreshNow();
            },
            error: (err) => {
                console.error('Error validating sale:', err);
                this.snackBar.open('Erreur lors de la validation', 'OK', { duration: 3000 });
            }
        });
    }

    validateReception(sale: InstanceSale): void {
        if (sale.status !== 'IN_TRANSIT') {
            this.snackBar.open('Aucun transfert en transit pour cette vente', 'OK', { duration: 3000 });
            return;
        }

        const confirm = window.confirm(
            `Confirmer la réception physique des produits pour la vente ${sale.facture.numero} ?\n` +
            `Ceci mettra à jour le stock local.`
        );

        if (!confirm) return;

        // Find products that are in transit (SHIPPED status in metadata)
        const productsToReceive = (sale.products || [])
            .filter(p => p.specificData?.pendingIncoming?.status === 'SHIPPED');

        if (productsToReceive.length === 0) {
            this.snackBar.open('Aucun produit prêt à être reçu (en transit)', 'OK', { duration: 3000 });
            return;
        }

        // Parallel execution of receptions
        const requests = productsToReceive.map(p => this.productService.completeTransfer(p.id).pipe(
            catchError(err => {
                console.error(`Error receiving product ${p.id}:`, err);
                return of(null);
            })
        ));

        forkJoin(requests).subscribe({
            next: (results) => {
                const successCount = results.filter(r => r !== null).length;
                if (successCount === productsToReceive.length) {
                    this.snackBar.open('Réception validée avec succès !', 'OK', { duration: 4000 });
                } else {
                    this.snackBar.open(`Réception partielle (${successCount}/${productsToReceive.length})`, 'OK', { duration: 4000 });
                }
                this.monitor.refreshNow();
            },
            error: (err) => {
                console.error('Error in forkJoin reception:', err);
                this.snackBar.open('Erreur lors de la confirmation de réception', 'OK', { duration: 3000 });
            }
        });
    }

    viewDetails(sale: InstanceSale): void {
        if (sale.facture.ficheId) {
            this.router.navigate(['/p/clients/fiches', sale.facture.ficheId]);
        } else {
            this.snackBar.open('Aucune fiche associée', 'OK', { duration: 3000 });
        }
    }

    cancelSale(sale: InstanceSale): void {
        const confirm = window.confirm(
            `Voulez-vous annuler la vente ${sale.facture.numero} ?\n\n` +
            `Le stock sera restauré à 0.`
        );

        if (!confirm) return;

        const updateData = {
            statut: 'ANNULEE',
            proprietes: {
                ...(sale.facture.proprietes || {}),
                cancelReason: 'Annulé depuis le dashboard',
                cancelledAt: new Date(),
                restoreStock: true
            }
        } as any;

        this.factureService.update(sale.facture.id, updateData).subscribe({
            next: () => {
                this.snackBar.open('Vente annulée, stock restauré', 'OK', { duration: 3000 });
                this.monitor.clearNotification(sale.facture.id);
                this.monitor.refreshNow();
            },
            error: (err) => {
                console.error('Error cancelling sale:', err);
                this.snackBar.open('Erreur lors de l\'annulation', 'OK', { duration: 3000 });
            }
        });
    }

    getProductsSummary(lignes: any[]): string {
        if (!lignes || lignes.length === 0) return 'Aucun produit';

        const first = lignes[0].designation || 'Produit';
        if (lignes.length === 1) return first;

        return `${first} +${lignes.length - 1} autre${lignes.length > 2 ? 's' : ''}`;
    }

    countByStatus(sales: InstanceSale[] | null, status: string): number {
        if (!sales) return 0;
        return sales.filter(s => s.status === status).length;
    }

    hasStatus(sales: InstanceSale[] | null, status: string): boolean {
        return this.countByStatus(sales, status) > 0;
    }

    notifyReady(sale: InstanceSale): void {
        const client = sale.facture.client;
        if (!client?.telephone) {
            this.snackBar.open('Ce client n\'a pas de numéro de téléphone', 'Fermer', { duration: 3000 });
            return;
        }

        const name = this.getClientNameForSale(client);
        this.messagingService.openWhatsApp(client.telephone, 'DELIVERY_READY', { name });
    }

    notifyDelay(sale: InstanceSale): void {
        const client = sale.facture.client;
        if (!client?.telephone) {
            this.snackBar.open('Ce client n\'a pas de numéro de téléphone', 'Fermer', { duration: 3000 });
            return;
        }

        const name = this.getClientNameForSale(client);
        this.messagingService.openWhatsApp(client.telephone, 'DELIVERY_DELAY', { name });
    }

    private getClientNameForSale(client: any): string {
        if (client.typeClient === 'professionnel') {
            return client.raisonSociale || 'Client professionnel';
        }
        const nom = client.nom || '';
        const prenom = client.prenom || '';
        return prenom ? `${nom} ${prenom}` : nom || 'Client';
    }
}
