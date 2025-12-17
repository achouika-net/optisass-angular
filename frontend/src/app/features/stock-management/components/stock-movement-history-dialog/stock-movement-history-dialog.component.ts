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
    displayedColumns: string[] = ['date', 'type', 'quantite', 'motif', 'user'];
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
            'ENTREE_RETOUR_CLIENT': 'Retour Client',
            'SORTIE_RETOUR_FOURNISSEUR': 'Retour Fournisseur',
            'INVENTAIRE': 'Inventaire',
            'CASSE': 'Casse'
        };
        return labels[type] || type;
    }

    isPositive(type: string): boolean {
        return ['ENTREE_ACHAT', 'ENTREE_RETOUR_CLIENT'].includes(type);
    }
}
