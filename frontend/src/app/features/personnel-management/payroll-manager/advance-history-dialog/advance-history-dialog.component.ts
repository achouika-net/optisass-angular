import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { PersonnelService } from '../../services/personnel.service';
import { Payroll } from '../../../../shared/interfaces/employee.interface';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-advance-history-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatTableModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule
    ],
    templateUrl: './advance-history-dialog.component.html'
})
export class AdvanceHistoryDialogComponent implements OnInit {
    advances: any[] = [];
    isLoading = true;
    displayedColumns: string[] = ['date', 'montant', 'modePaiement', 'description'];

    constructor(
        private personnelService: PersonnelService,
        private cd: ChangeDetectorRef,
        public dialogRef: MatDialogRef<AdvanceHistoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { employeeId: string, employeeName: string }
    ) { }

    ngOnInit(): void {
        setTimeout(() => {
            this.loadHistory();
        }, 100);
    }

    loadHistory(): void {
        this.isLoading = true;
        this.cd.detectChanges();

        this.personnelService.getEmployeeAdvances(this.data.employeeId)
            .pipe(finalize(() => {
                this.isLoading = false;
                this.cd.detectChanges();
            }))
            .subscribe({
                next: (items) => {
                    this.advances = items || [];
                },
                error: (err) => {
                    console.error('Error loading advance history', err);
                }
            });
    }
}
