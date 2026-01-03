import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { FinanceService } from '../../services/finance.service';
import { Supplier } from '../../models/finance.models';

@Component({
    selector: 'app-supplier-situation-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatDividerModule
    ],
    template: `
    <h2 mat-dialog-title>
        <div class="flex items-center gap-2">
            <mat-icon class="text-blue-600">analytics</mat-icon>
            Situation Globale - {{ data.supplier.nom }}
        </div>
    </h2>
    
    <mat-dialog-content class="mat-typography">
        <div class="situation-container py-4" *ngIf="loading; else content">
            <div class="flex justify-center items-center h-32">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        </div>

        <ng-template #content>
            <div class="grid grid-cols-2 gap-4 mb-6" *ngIf="situation">
                <mat-card class="p-4 bg-gray-50">
                    <div class="text-sm text-gray-500 uppercase">Total Commandé (TTC)</div>
                    <div class="text-2xl font-bold text-gray-800">{{ situation.totalTTC | currency:'MAD':'MAD ':'1.2-2' }}</div>
                    <div class="text-xs text-gray-400">{{ situation.invoiceCount }} factures</div>
                </mat-card>

                <mat-card class="p-4 bg-green-50 border border-green-100">
                    <div class="text-sm text-green-700 uppercase">Total Payé</div>
                    <div class="text-2xl font-bold text-green-600">{{ situation.totalPaye | currency:'MAD':'MAD ':'1.2-2' }}</div>
                </mat-card>

                <div class="col-span-2">
                    <mat-card class="p-6 bg-red-50 border border-red-100 flex justify-between items-center">
                        <div>
                            <div class="text-sm text-red-700 uppercase font-medium">Reste à Payer</div>
                            <div class="text-3xl font-extrabold text-red-600">{{ situation.resteAPayer | currency:'MAD':'MAD ':'1.2-2' }}</div>
                        </div>
                        <mat-icon class="text-red-300 scale-150">money_off</mat-icon>
                    </mat-card>
                </div>
            </div>

            <div class="text-center text-sm text-gray-500" *ngIf="!situation">
                Impossible de charger la situation.
            </div>
        </ng-template>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Fermer</button>
        <button mat-raised-button color="primary" mat-dialog-close cdkFocusInitial>OK</button>
    </mat-dialog-actions>
  `,
    styles: [`
    .situation-container { min-width: 400px; }
  `]
})
export class SupplierSituationDialogComponent implements OnInit {
    loading = true;
    situation: any = null;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { supplier: Supplier },
        private financeService: FinanceService
    ) { }

    ngOnInit() {
        this.loadSituation();
    }

    loadSituation() {
        this.financeService.getSupplierSituation(this.data.supplier.id).subscribe({
            next: (res) => {
                this.situation = res;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading situation', err);
                this.loading = false;
            }
        });
    }
}
