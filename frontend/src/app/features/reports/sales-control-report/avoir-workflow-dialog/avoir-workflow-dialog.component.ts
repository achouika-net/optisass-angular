import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { BrouillonInvoice } from '../../services/sales-control.service';

@Component({
    selector: 'app-avoir-workflow-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatCheckboxModule,
        MatListModule,
        MatDividerModule,
        FormsModule
    ],
    templateUrl: './avoir-workflow-dialog.component.html',
    styleUrl: './avoir-workflow-dialog.component.scss'
})
export class AvoirWorkflowDialogComponent implements OnInit {
    items: any[] = [];

    constructor(
        public dialogRef: MatDialogRef<AvoirWorkflowDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { invoice: BrouillonInvoice }
    ) { }

    ngOnInit(): void {
        if (this.data.invoice.lignes) {
            this.items = (this.data.invoice.lignes as any[]).map((l, index) => ({
                ...l,
                index,
                returned: true // Default to return everything to stock
            }));
        }
    }

    get totalReturned(): number {
        return this.items.filter(i => i.returned).reduce((sum, i) => sum + i.totalTTC, 0);
    }

    get totalKept(): number {
        return this.items.filter(i => !i.returned).reduce((sum, i) => sum + i.totalTTC, 0);
    }

    onConfirm(): void {
        const itemsToReturn = this.items.filter(i => i.returned).map(i => i.index);
        const itemsToKeep = this.items.filter(i => !i.returned).map(i => i.index);

        this.dialogRef.close({ itemsToReturn, itemsToKeep });
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
