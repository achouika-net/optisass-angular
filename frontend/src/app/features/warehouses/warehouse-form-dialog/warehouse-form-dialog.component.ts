import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { WarehousesService } from '../services/warehouses.service';
import { Entrepot, EntrepotType } from '../../../shared/interfaces/warehouse.interface';

@Component({
    selector: 'app-warehouse-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
    ],
    templateUrl: './warehouse-form-dialog.component.html',
    styleUrls: ['./warehouse-form-dialog.component.scss']
})
export class WarehouseFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode = false;
    centreId: string;
    entrepotTypes = Object.values(EntrepotType);

    constructor(
        private fb: FormBuilder,
        private warehousesService: WarehousesService,
        public dialogRef: MatDialogRef<WarehouseFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { entrepot: Entrepot | null; centreId: string }
    ) {
        this.isEditMode = !!data.entrepot;
        this.centreId = data.centreId;
        this.form = this.fb.group({
            nom: [data.entrepot?.nom || '', Validators.required],
            description: [data.entrepot?.description || ''],
            type: [data.entrepot?.type || EntrepotType.PRINCIPAL, Validators.required],
            capaciteMax: [data.entrepot?.capaciteMax || null],
            surface: [data.entrepot?.surface || null],
            responsable: [data.entrepot?.responsable || ''],
        });
    }

    ngOnInit(): void { }

    onSubmit(): void {
        if (this.form.valid) {
            const formData = { ...this.form.value, centreId: this.centreId };

            if (this.isEditMode && this.data.entrepot?.id) {
                this.warehousesService.update(this.data.entrepot.id, formData).subscribe({
                    next: () => this.dialogRef.close(true),
                    error: (err) => {
                        console.error('Error updating warehouse:', err);
                        alert('Erreur lors de la mise à jour de l\'entrepôt');
                    }
                });
            } else {
                this.warehousesService.create(formData).subscribe({
                    next: () => this.dialogRef.close(true),
                    error: (err) => {
                        console.error('Error creating warehouse:', err);
                        alert('Erreur lors de la création de l\'entrepôt');
                    }
                });
            }
        }
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
