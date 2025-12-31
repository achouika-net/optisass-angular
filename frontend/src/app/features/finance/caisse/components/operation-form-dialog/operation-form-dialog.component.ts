import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OperationCaisseService } from '../../services/operation-caisse.service';
import { OperationCaisse, OperationType, TypeOperation, MoyenPaiement, CaisseType } from '../../models/caisse.model';
import { OperationTypeGuard } from '../../guards/operation-type.guard';

export interface DialogData {
    journeeId: string;
    type?: OperationType;
    caisseType?: CaisseType;
    availableBalances?: {
        ESPECES: number;
        CARTE: number;
        CHEQUE: number;
    };
}

@Component({
    selector: 'app-operation-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './operation-form-dialog.component.html',
    styleUrls: ['./operation-form-dialog.component.scss'],
})
export class OperationFormDialogComponent {
    form: FormGroup;
    loading = false;
    canCreateInterne = false;
    types = Object.values(OperationType);
    moyensPaiement = Object.values(MoyenPaiement);
    currentUser = 'Utilisateur Test'; // TODO: Get from AuthService

    // Administrative presets for Main Caisse
    presets = [
        'Versement Banque (Encaissement)',
        'Dépôt Coffre',
        'Avance sur Salaire',
        'Salaire',
        'Régularisation'
    ];

    constructor(
        private fb: FormBuilder,
        private operationService: OperationCaisseService,
        private guard: OperationTypeGuard,
        public dialogRef: MatDialogRef<OperationFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: DialogData
    ) {
        this.canCreateInterne = this.guard.canCreateInterneOperation();

        const initialAmount = (this.data.type === OperationType.DECAISSEMENT && this.data.availableBalances)
            ? this.data.availableBalances.ESPECES
            : 0;

        this.form = this.fb.group({
            type: [data.type || OperationType.ENCAISSEMENT, Validators.required],
            typeOperation: [TypeOperation.COMPTABLE, Validators.required],
            montant: [initialAmount, [Validators.required, Validators.min(0.01)]],
            moyenPaiement: [MoyenPaiement.ESPECES, Validators.required],
            motif: [''],
            reference: [''],
        });

        // Auto-fill montant based on moyenPaiement for DECAISSEMENT
        this.form.get('moyenPaiement')?.valueChanges.subscribe(moyen => {
            if (this.form.get('type')?.value === OperationType.DECAISSEMENT && this.data.availableBalances) {
                const balance = (this.data.availableBalances as any)[moyen] || 0;
                this.form.get('montant')?.setValue(balance);
            }
        });

        // Handle conditional validation for motif
        this.form.get('type')?.valueChanges.subscribe(type => {
            const motifControl = this.form.get('motif');
            if (type === OperationType.DECAISSEMENT) {
                motifControl?.setValidators(Validators.required);
            } else {
                motifControl?.clearValidators();
            }
            motifControl?.updateValueAndValidity();
        });

        // If type is DECAISSEMENT, trigger validation check initially
        if (this.data.type === OperationType.DECAISSEMENT) {
            this.form.get('motif')?.setValidators(Validators.required);
            this.form.get('motif')?.updateValueAndValidity();
        }
    }

    onSubmit(): void {
        if (this.form.valid) {
            this.loading = true;
            const formValue = this.form.value;

            const dto = {
                ...formValue,
                journeeCaisseId: this.data.journeeId,
                utilisateur: this.currentUser
            };

            this.operationService.create(dto, this.guard.getUserRole() || undefined).subscribe({
                next: (result) => {
                    this.loading = false;
                    this.dialogRef.close(result);
                },
                error: (error) => {
                    this.loading = false;
                    console.error('Error creating operation', error);
                    // Error handling could be improved here
                }
            });
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
