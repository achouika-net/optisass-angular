import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';
import { AccountingService } from '../services/accounting.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector, UserCentresSelector } from '../../../core/store/auth/auth.selectors';
import { format, startOfMonth, endOfMonth } from 'date-fns';

@Component({
    selector: 'app-accounting-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatProgressSpinnerModule,
        MatInputModule,
        MatSnackBarModule
    ],
    templateUrl: './accounting-dashboard.component.html',
    styleUrls: ['./accounting-dashboard.component.scss']
})
export class AccountingDashboardComponent implements OnInit {
    exportForm: FormGroup;
    isLoading = signal(false);
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    allCentres = this.store.selectSignal(UserCentresSelector);

    constructor(
        private accountingService: AccountingService,
        private store: Store,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        const now = new Date();
        this.exportForm = new FormGroup({
            startDate: new FormControl(startOfMonth(now)),
            endDate: new FormControl(endOfMonth(now)),
            centreId: new FormControl('')
        });
    }

    ngOnInit(): void {
        const centre = this.currentCentre() as any;
        if (centre?.id) {
            this.exportForm.patchValue({ centreId: centre.id });
        }
    }

    getCentreId(c: any): string {
        return c?.id || c?.centreId || '';
    }

    getCentreNom(c: any): string {
        return c?.nom || c?.name || c?.centre?.nom || c?.centre?.name || 'Centre sans nom';
    }

    onExport(): void {
        this.isLoading.set(true);
        const { startDate, endDate, centreId } = this.exportForm.value;
        const start = format(startDate, 'yyyy-MM-dd');
        const end = format(endDate, 'yyyy-MM-dd');

        this.accountingService.exportSage(start, end, centreId)
            .pipe(finalize(() => {
                this.isLoading.set(false);
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (blob) => {
                    if (blob.size < 100) {
                        this.snackBar.open('Aucune donnée trouvée pour cette période', 'Fermer', { duration: 3000 });
                        return;
                    }
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Sage_Export_${start}_${end}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    this.snackBar.open('Export Sage réussi', 'OK', { duration: 3000 });
                },
                error: (err) => {
                    console.error('Export failed', err);
                    this.snackBar.open('Erreur lors de l\'export', 'Fermer', { duration: 5000 });
                }
            });
    }

    onExportPdf(): void {
        this.isLoading.set(true);
        const { startDate, endDate, centreId } = this.exportForm.value;
        const start = format(startDate, 'yyyy-MM-dd');
        const end = format(endDate, 'yyyy-MM-dd');

        this.accountingService.exportPdf(start, end, centreId)
            .pipe(finalize(() => {
                this.isLoading.set(false);
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Journal_Comptable_${start}_${end}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    this.snackBar.open('Journal PDF généré', 'OK', { duration: 3000 });
                },
                error: (err) => {
                    console.error('PDF Export failed', err);
                    this.snackBar.open('Erreur lors de la génération du PDF', 'Fermer', { duration: 5000 });
                }
            });
    }

    onExportExcel(): void {
        this.isLoading.set(true);
        const { startDate, endDate, centreId } = this.exportForm.value;
        const start = format(startDate, 'yyyy-MM-dd');
        const end = format(endDate, 'yyyy-MM-dd');

        this.accountingService.exportBalance(start, end, centreId)
            .pipe(finalize(() => {
                this.isLoading.set(false);
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Balance_Comptable_${start}_${end}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    this.snackBar.open('Balance générée avec succès', 'OK', { duration: 3000 });
                },
                error: (err) => {
                    console.error('Balance export failed', err);
                    this.snackBar.open('Erreur lors de la génération de la Balance', 'Fermer', { duration: 5000 });
                }
            });
    }

    onExportBilan(): void {
        this.isLoading.set(true);
        const { startDate, endDate, centreId } = this.exportForm.value;
        const start = format(startDate, 'yyyy-MM-dd');
        const end = format(endDate, 'yyyy-MM-dd');

        this.accountingService.exportBilan(start, end, centreId)
            .pipe(finalize(() => {
                this.isLoading.set(false);
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Bilan_Comptable_${start}_${end}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    this.snackBar.open('Bilan Comptable généré avec succès', 'OK', { duration: 3000 });
                },
                error: (err) => {
                    console.error('Bilan export failed', err);
                    this.snackBar.open('Erreur lors de la génération du Bilan', 'Fermer', { duration: 5000 });
                }
            });
    }
}
