import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PersonnelService } from '../../services/personnel.service';
import { Payroll } from '../../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-commission-details-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatTableModule,
        MatButtonModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './commission-details-dialog.component.html'
})
export class CommissionDetailsDialogComponent implements OnInit {
    commissions: any[] = [];
    summary: { type: string, total: number, count: number }[] = [];
    isLoading = true;
    displayedColumns: string[] = ['date', 'facture', 'type', 'montant'];

    constructor(
        private personnelService: PersonnelService,
        public dialogRef: MatDialogRef<CommissionDetailsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: Payroll
    ) { }

    ngOnInit(): void {
        console.log('CommissionDetailsDialogComponent: ngOnInit', this.data);
        this.loadDetails();
    }

    loadDetails(): void {
        if (!this.data) {
            console.error('CommissionDetailsDialogComponent: No data provided!');
            this.isLoading = false;
            return;
        }

        const employeeId = this.data.employeeId || (this.data as any).employee_id;
        const mois = this.data.mois;
        const annee = this.data.annee;

        console.log(`CommissionDetailsDialogComponent: Fetching for employee=${employeeId}, mois=${mois}, annee=${annee}`);

        if (!employeeId || !mois) {
            console.warn('CommissionDetailsDialogComponent: Missing employeeId or mois', { employeeId, mois });
            this.isLoading = false;
            return;
        }

        this.personnelService.getEmployeeCommissions(employeeId, mois, annee)
            .subscribe({
                next: (items) => {
                    console.log(`CommissionDetailsDialogComponent: Received ${items?.length} items`);
                    this.commissions = items || [];
                    this.calculateSummary();
                    this.isLoading = false;
                },
                error: (err) => {
                    console.error('CommissionDetailsDialogComponent: Error loading details', err);
                    this.isLoading = false;
                }
            });
    }

    calculateSummary(): void {
        const groups: { [key: string]: { total: number, count: number } } = {};

        this.commissions.forEach(c => {
            const type = c.type || 'INCONNU';
            if (!groups[type]) {
                groups[type] = { total: 0, count: 0 };
            }
            groups[type].total += c.montant || 0;
            groups[type].count += 1;
        });

        this.summary = Object.keys(groups).map(type => ({
            type,
            total: groups[type].total,
            count: groups[type].count
        })).sort((a, b) => b.total - a.total);
    }
}
