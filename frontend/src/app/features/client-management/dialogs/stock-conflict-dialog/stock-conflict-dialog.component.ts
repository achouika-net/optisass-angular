import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface StockConflict {
    productId: string;
    designation: string;
    requestedQty: number;
    localAvailableQty: number;
    localCentreId: string;
    alternatives: {
        productId: string;
        centreId: string;
        centreNom: string;
        availableQty: number;
        entrepotNom: string;
    }[];
}

@Component({
    selector: 'app-stock-conflict-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatChipsModule,
        MatTooltipModule
    ],
    templateUrl: './stock-conflict-dialog.component.html',
    styles: [`
        .conflict-table {
            width: 100%;
            margin-top: 20px;
        }
        .action-cell {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        .badge-warning {
            background-color: #fff3e0;
            color: #ef6c00;
        }
        .alternative-info {
            font-size: 0.85em;
            color: #666;
            margin-top: 4px;
        }
    `]
})
export class StockConflictDialogComponent {
    displayedColumns: string[] = ['product', 'status', 'alternatives', 'actions'];

    constructor(
        public dialogRef: MatDialogRef<StockConflictDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { conflicts: StockConflict[] }
    ) { }

    onRequestTransfer(conflict: StockConflict, alternative: any) {
        this.dialogRef.close({
            action: 'TRANSFER_REQUEST',
            productId: conflict.productId,
            sourceCentreId: alternative.centreId,
            targetCentreId: conflict.localCentreId
        });
    }

    onReplace() {
        this.dialogRef.close({ action: 'REPLACE' });
    }

    onCancelSale() {
        this.dialogRef.close({ action: 'CANCEL_SALE' });
    }
}
