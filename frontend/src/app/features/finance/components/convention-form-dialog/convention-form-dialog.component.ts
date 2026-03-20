import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FinanceService } from '../../services/finance.service';
import { Convention } from '../../models/finance.models';

@Component({
    selector: 'app-convention-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatSelectModule,
        MatTooltipModule,
        MatProgressBarModule,
        MatCheckboxModule
    ],
    templateUrl: './convention-form-dialog.component.html',
    styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
    .col { flex: 1; min-width: 200px; }
  `]
})
export class ConventionFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode: boolean;
    submitting: boolean = false;

    remiseTypes = [
        { value: 'PERCENTAGE', label: 'Pourcentage (%)' },
        { value: 'FLAT_AMOUNT', label: 'Montant Forfaitaire (DH)' }
    ];

    constructor(
        private fb: FormBuilder,
        private financeService: FinanceService,
        private cdr: ChangeDetectorRef,
        public dialogRef: MatDialogRef<ConventionFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { convention?: Convention }
    ) {
        this.isEditMode = !!(data?.convention);
        this.form = this.fb.group({
            nom: [data?.convention?.nom || '', Validators.required],
            description: [data?.convention?.description || ''],
            contact: [data?.convention?.contact || ''],
            email: [data?.convention?.email || '', [Validators.email]],
            telephone: [data.convention?.telephone || ''],
            adresse: [data.convention?.adresse || ''],
            remiseType: [data.convention?.remiseType || 'PERCENTAGE', Validators.required],
            remiseValeur: [data.convention?.remiseValeur || 0, [Validators.required, Validators.min(0)]],
            remiseForfaitaire: [data.convention?.remiseForfaitaire || false],
            montantForfaitaire: [data.convention?.montantForfaitaire || 0],
            montantForfaitaireMonture: [data.convention?.montantForfaitaireMonture || 0],
            montantForfaitaireVerre: [data.convention?.montantForfaitaireVerre || 0],
            notes: [data.convention?.notes || '']
        });
    }

    ngOnInit(): void {}

    onSubmit() {
        if (this.form.valid) {
            this.submitting = true;
            this.cdr.detectChanges();
            const conventionData = this.form.value;
            if (this.isEditMode && this.data.convention?.id) {
                this.financeService.updateConvention(this.data.convention.id, conventionData).subscribe({
                    next: (res) => this.dialogRef.close(res),
                    error: (err) => {
                        console.error('Update failed', err);
                        this.submitting = false;
                    }
                });
            } else {
                this.financeService.createConvention(conventionData).subscribe({
                    next: (res) => this.dialogRef.close(res),
                    error: (err) => {
                        console.error('Creation failed', err);
                        this.submitting = false;
                    }
                });
            }
        } else {
            this.form.markAllAsTouched();
        }
    }

    onCancel() {
        this.dialogRef.close();
    }
}
