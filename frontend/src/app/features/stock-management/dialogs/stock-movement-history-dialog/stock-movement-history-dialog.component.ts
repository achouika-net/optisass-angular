import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StockMovementsService, StockMovement } from '../../services/stock-movements.service';
import { Product } from '../../../../shared/interfaces/product.interface';

@Component({
    selector: 'app-stock-movement-history-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './stock-movement-history-dialog.component.html',
    styleUrls: ['./stock-movement-history-dialog.component.scss']
})
export class StockMovementHistoryDialogComponent implements OnInit {
    movements: StockMovement[] = [];
    displayedColumns: string[] = [
        'dateMovement',
        'type',
        'entrepot',
        'quantite',
        'prixAchat',
        'prixVente',
        'ficheNumero',
        'clientNom',
        'motif',
        'utilisateur'
    ];
    loading = true;

    constructor(
        public dialogRef: MatDialogRef<StockMovementHistoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { product: Product },
        private stockMovementsService: StockMovementsService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        console.log('StockMovementHistoryDialog initialized with data:', this.data);
        if (!this.data || !this.data.product) {
            console.error('No product data provided to dialog!');
            this.loading = false;
            return;
        }
        this.loadHistory();
    }

    loadHistory(): void {
        this.loading = true;
        console.log('Loading history for product ID:', this.data.product.id);

        this.stockMovementsService.getHistory(this.data.product.id).subscribe({
            next: (data) => {
                console.log('History loaded successfully:', data);
                this.movements = data;
                this.loading = false;
                this.cdr.detectChanges(); // Force update
            },
            error: (err) => {
                console.error('Error loading history:', err);
                this.loading = false;
                this.cdr.detectChanges(); // Force update
            }
        });
    }

    close(): void {
        this.dialogRef.close();
    }

    getTypeLabel(type: string): string {
        const labels: { [key: string]: string } = {
            'ENTREE_ACHAT': 'Achat',
            'SORTIE_VENTE': 'Vente',
            'TRANSFERT': 'Transfert',
            'TRANSFERT_ENTREE': 'Réception Tr.',
            'TRANSFERT_SORTIE': 'Expédition Tr.',
            'TRANSFERT_INIT': 'Transfert Init',
            'RECEPTION': 'Réception',
            'ENTREE_RETOUR_CLIENT': 'Retour Client',
            'SORTIE_RETOUR_FOURNISSEUR': 'Retour Fourn.',
            'INVENTAIRE': 'Inventaire',
            'CASSE': 'Casse',
            'AJUSTEMENT': 'Ajustement',
            'MIGRATION': 'Migration'
        };
        return labels[type] || type;
    }

    getWarehouseName(movement: StockMovement): string {
        if (movement.entrepotDestination && movement.entrepotSource) {
            return `${movement.entrepotSource.nom} ➔ ${movement.entrepotDestination.nom}`;
        }
        return movement.entrepotDestination?.nom || movement.entrepotSource?.nom || '--';
    }

    isPositive(type: string): boolean {
        return ['ENTREE_ACHAT', 'ENTREE_RETOUR_CLIENT', 'RECEPTION', 'TRANSFERT_ENTREE', 'TRANSFERT_INIT'].includes(type);
    }

    getClientName(movement: StockMovement): string {
        if (!movement.facture?.client) return '--';

        const client = movement.facture.client;
        if (client.raisonSociale) {
            return client.raisonSociale;
        }
        if (client.nom && client.prenom) {
            return `${client.nom} ${client.prenom}`;
        }
        return client.nom || client.prenom || '--';
    }

    getFicheNumero(movement: StockMovement): string {
        return movement.facture?.numero || '--';
    }

    formatPrice(price: number | undefined): string {
        return price ? `${price.toFixed(2)} DH` : '--';
    }
}
