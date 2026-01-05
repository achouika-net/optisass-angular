import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PersonnelService } from '../services/personnel.service';
import { Employee, Payroll } from '../../../shared/interfaces/employee.interface';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'app-payroll-manager',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatTableModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatSnackBarModule,
        MatDialogModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './payroll-manager.component.html',
    styleUrls: ['./payroll-manager.component.scss']
})
export class PayrollManagerComponent implements OnInit {
    payrolls: Payroll[] = [];
    employees: Employee[] = [];
    displayedColumns: string[] = ['employee', 'mois', 'salaireBase', 'commissions', 'netAPayer', 'statut', 'actions'];

    selectedMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    isLoading = false;

    constructor(
        private personnelService: PersonnelService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.loadEmployees();
        this.loadPayrolls();
    }

    loadEmployees(): void {
        this.personnelService.getEmployees().subscribe(employees => {
            this.employees = employees;
        });
    }

    loadPayrolls(): void {
        this.isLoading = true;
        const [annee, mois] = this.selectedMonth.split('-');
        this.personnelService.getPayrolls(mois, parseInt(annee)).subscribe({
            next: (payrolls) => {
                this.payrolls = payrolls;
                this.isLoading = false;
            },
            error: () => this.isLoading = false
        });
    }

    generateAll(): void {
        if (!this.employees.length) return;
        this.isLoading = true;
        const [annee, mois] = this.selectedMonth.split('-');

        let processed = 0;
        this.employees.forEach(emp => {
            this.personnelService.generatePayroll(emp.id!, mois, parseInt(annee)).subscribe({
                next: () => {
                    processed++;
                    if (processed === this.employees.length) {
                        this.loadPayrolls();
                        this.snackBar.open('Bulletins générés avec succès', 'OK', { duration: 3000 });
                    }
                },
                error: (err) => {
                    processed++;
                    console.error(err);
                }
            });
        });
    }

    validatePayroll(p: Payroll): void {
        this.personnelService.validatePayroll(p.id!).subscribe(() => {
            this.loadPayrolls();
            this.snackBar.open('Bulletin validé', 'OK', { duration: 2000 });
        });
    }

    payPayroll(p: Payroll): void {
        const centreId = p.employee?.centres?.[0]?.centreId; // Should ask user or use default
        if (!centreId) {
            this.snackBar.open('Impossible de payer : Aucun centre affecté', 'Fermer', { duration: 3000 });
            return;
        }

        const userId = 'system'; // Or current user
        this.personnelService.payPayroll(p.id!, centreId, userId).subscribe(() => {
            this.loadPayrolls();
            this.snackBar.open('Salaire marqué comme payé (Dépense créée)', 'OK', { duration: 3000 });
        });
    }

    downloadPdf(p: Payroll): void {
        if (!p.pdfUrl) return;
        const url = `${environment.apiUrl}${p.pdfUrl}`;
        window.open(url, '_blank');
    }

    getStatusClass(statut: string): string {
        switch (statut) {
            case 'BROUILLON': return 'status-draft';
            case 'VALIDE': return 'status-validated';
            case 'PAYE': return 'status-paid';
            default: return '';
        }
    }
}
