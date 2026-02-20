import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { CaisseService } from '../../services/caisse.service';
import { Caisse, CaisseType } from '../../models/caisse.model';

export interface CaisseDialogData {
    caisse?: Caisse;
    centreId: string;
}

@Component({
    selector: 'app-caisse-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule
    ],
    template: `
        <h2 mat-dialog-title>{{ data.caisse ? 'Modifier' : 'Nouvelle' }} Caisse</h2>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-dialog-content>
                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Nom de la caisse</mat-label>
                    <input matInput formControlName="nom" placeholder="Ex: Caisse Principale">
                    <mat-error *ngIf="form.get('nom')?.hasError('required')">
                        Le nom est requis
                    </mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Type de caisse</mat-label>
                    <mat-select formControlName="type">
                        <mat-option [value]="CaisseType.PRINCIPALE">Caisse Principale (Ventes)</mat-option>
                        <mat-option [value]="CaisseType.DEPENSES">Caisse Dépenses (Interne)</mat-option>
                        <mat-option [value]="CaisseType.MIXTE">Caisse Mixte (Ventes + Interne)</mat-option>
                    </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Description</mat-label>
                    <textarea matInput formControlName="description" rows="3"></textarea>
                </mat-form-field>
            </mat-dialog-content>

            <mat-dialog-actions align="end">
                <button mat-button type="button" (click)="onCancel()">Annuler</button>
                <button mat-raised-button color="primary" type="submit">
                    {{ data.caisse ? 'Enregistrer' : 'Créer' }}
                </button>
            </mat-dialog-actions>
        </form>
    `,
    styles: [`
        .full-width {
            width: 100%;
            margin-bottom: 16px;
        }
    `]
})
export class CaisseFormDialogComponent {
    form: FormGroup;
    loading = false;
    CaisseType = CaisseType;

    constructor(
        private fb: FormBuilder,
        private caisseService: CaisseService,
        public dialogRef: MatDialogRef<CaisseFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CaisseDialogData
    ) {
        // Log received data for debugging
        console.log('CaisseFormDialog - Data received:', data);

        this.form = this.fb.group({
            nom: [data.caisse?.nom || '', Validators.required],
            description: [data.caisse?.description || ''],
            type: [data.caisse?.type || CaisseType.PRINCIPALE, Validators.required],
            centreId: [data.centreId, Validators.required]
        });
    }

    onSubmit(): void {
        console.log('Submitting form...', this.form.value);
        console.log('Form status:', this.form.status);

        if (this.form.invalid) {
            const controls = this.form.controls;
            const invalidControls = [];
            for (const name in controls) {
                if (controls[name].invalid) {
                    invalidControls.push(name);
                }
            }
            alert(` Formulaire invalide. Champs en erreur : ${invalidControls.join(', ')}`);
            return; // Stop here if invalid
        }

        this.loading = true;
        const request = this.data.caisse
            ? this.caisseService.update(this.data.caisse.id, this.form.value)
            : this.caisseService.create(this.form.value);

        request.subscribe({
            next: (result) => {
                this.loading = false;
                this.dialogRef.close(result);
            },
            error: (error) => {
                this.loading = false;
                console.error('Error saving caisse', error);
                alert(`Erreur lors de l'enregistrement : ${error.error?.message || error.message}`);
            }
        });
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
