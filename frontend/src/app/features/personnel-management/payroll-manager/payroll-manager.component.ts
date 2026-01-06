import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { EditPayrollDialogComponent } from './edit-payroll-dialog/edit-payroll-dialog.component';
import { PaymentModeDialogComponent } from './payment-mode-dialog/payment-mode-dialog.component';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { forkJoin, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { UserIdSelector } from '../../../core/store/auth/auth.selectors';

export const MY_FORMATS = {
    parse: {
        dateInput: 'MM/YYYY',
    },
    display: {
        dateInput: 'MM/YYYY',
        monthYearLabel: 'MMM YYYY',
        dateA11yLabel: 'LL',
        monthYearA11yLabel: 'MMMM YYYY',
    },
};

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
        MatSnackBarModule,
        MatDialogModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatDatepickerModule,
        MatNativeDateModule,
        ReactiveFormsModule,
        MatInputModule,
        MatFormFieldModule
    ],
    providers: [
        { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
    ],
    templateUrl: './payroll-manager.component.html',
    styleUrls: ['./payroll-manager.component.scss']
})
export class PayrollManagerComponent implements OnInit {
    payrolls: Payroll[] = [];
    employees: Employee[] = [];
    displayedColumns: string[] = ['employee', 'mois', 'salaireBase', 'commissions', 'netAPayer', 'statut', 'actions'];

    dateCtrl = new FormControl(new Date());
    isLoading = false;

    constructor(
        private personnelService: PersonnelService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef,
        private store: Store
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
        const date = this.dateCtrl.value || new Date();
        const annee = date.getFullYear();
        const mois = (date.getMonth() + 1).toString().padStart(2, '0');

        this.personnelService.getPayrolls(mois, annee).subscribe({
            next: (payrolls) => {
                this.payrolls = payrolls;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    chosenYearHandler(normalizedYear: Date) {
        const ctrlValue = this.dateCtrl.value || new Date();
        ctrlValue.setFullYear(normalizedYear.getFullYear());
        this.dateCtrl.setValue(ctrlValue);
    }

    chosenMonthHandler(normalizedMonth: Date, datepicker: MatDatepicker<Date>) {
        const ctrlValue = this.dateCtrl.value || new Date();
        ctrlValue.setMonth(normalizedMonth.getMonth());
        this.dateCtrl.setValue(ctrlValue);
        datepicker.close();
        this.loadPayrolls();
    }

    generateAll(): void {
        if (!this.employees.length) return;
        this.isLoading = true;

        const date = this.dateCtrl.value || new Date();
        const annee = date.getFullYear();
        const mois = (date.getMonth() + 1).toString().padStart(2, '0');

        const requests = this.employees.map(emp =>
            this.personnelService.generatePayroll(emp.id!, mois, annee).pipe(
                catchError(err => {
                    console.error(`Error generating payroll for ${emp.id}:`, err);
                    return of(null); // Continue with other requests
                })
            )
        );

        forkJoin(requests).subscribe({
            next: () => {
                this.snackBar.open('Bulletins générés avec succès', 'OK', { duration: 3000 });
                this.loadPayrolls();
            },
            error: (err) => {
                console.error('Critical error in batch generation:', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
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

        const dialogRef = this.dialog.open(PaymentModeDialogComponent, { width: '400px' });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.mode) {
                this.store.select(UserIdSelector).pipe(take(1)).subscribe(userId => {
                    const finalUserId = userId || 'system';
                    this.personnelService.payPayroll(
                        p.id!,
                        centreId,
                        String(finalUserId),
                        result.mode,
                        result.banque,
                        result.reference,
                        result.dateEcheance
                    ).subscribe(() => {
                        this.loadPayrolls();
                        this.snackBar.open(`Salaire payé par ${result.mode}`, 'OK', { duration: 3000 });
                    });
                });
            }
        });
    }

    downloadPdf(p: Payroll): void {
        if (!p.pdfUrl) return;
        const url = `${environment.apiUrl}${p.pdfUrl}`;
        window.open(url, '_blank');
    }

    openEditDialog(p: Payroll): void {
        const dialogRef = this.dialog.open(EditPayrollDialogComponent, {
            width: '500px',
            data: p
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.personnelService.updatePayroll(p.id!, result).subscribe({
                    next: () => {
                        this.loadPayrolls();
                        this.snackBar.open('Bulletin mis à jour', 'OK', { duration: 3000 });
                    },
                    error: (err) => console.error('Error updating payroll', err)
                });
            }
        });
    }

    deletePayroll(p: Payroll): void {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce bulletin ?')) {
            this.personnelService.deletePayroll(p.id!).subscribe({
                next: () => {
                    this.loadPayrolls();
                    this.snackBar.open('Bulletin supprimé', 'OK', { duration: 3000 });
                },
                error: (err) => console.error('Error deleting payroll', err)
            });
        }
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
