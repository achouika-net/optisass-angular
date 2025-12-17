import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CentersService } from '../services/centers.service';
import { Centre } from '../../../shared/interfaces/warehouse.interface';

@Component({
    selector: 'app-center-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
    templateUrl: './center-form-dialog.component.html',
    styleUrls: ['./center-form-dialog.component.scss']
})
export class CenterFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode = false;
    groupeId: string;

    constructor(
        private fb: FormBuilder,
        private centersService: CentersService,
        public dialogRef: MatDialogRef<CenterFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { centre: Centre | null; groupeId: string }
    ) {
        this.isEditMode = !!data.centre;
        this.groupeId = data.groupeId;
        this.form = this.fb.group({
            nom: [data.centre?.nom || '', Validators.required],
            description: [data.centre?.description || ''],
            adresse: [data.centre?.adresse || ''],
            ville: [data.centre?.ville || ''],
            codePostal: [data.centre?.codePostal || ''],
            telephone: [data.centre?.telephone || ''],
            email: [data.centre?.email || '', Validators.email],
        });
    }

    ngOnInit(): void { }

    onSubmit(): void {
        if (this.form.valid) {
            const formData = { ...this.form.value, groupeId: this.groupeId };

            if (this.isEditMode && this.data.centre?.id) {
                this.centersService.update(this.data.centre.id, formData).subscribe({
                    next: () => this.dialogRef.close(true),
                    error: (err) => {
                        console.error('Error updating center:', err);
                        alert('Erreur lors de la mise à jour du centre');
                    }
                });
            } else {
                this.centersService.create(formData).subscribe({
                    next: () => this.dialogRef.close(true),
                    error: (err) => {
                        console.error('Error creating center:', err);
                        alert('Erreur lors de la création du centre');
                    }
                });
            }
        }
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
