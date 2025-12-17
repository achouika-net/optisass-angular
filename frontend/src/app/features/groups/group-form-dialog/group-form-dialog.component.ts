import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GroupsService } from '../services/groups.service';
import { Groupe } from '../../../shared/interfaces/warehouse.interface';

@Component({
    selector: 'app-group-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
    ],
    templateUrl: './group-form-dialog.component.html',
    styleUrls: ['./group-form-dialog.component.scss']
})
export class GroupFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode = false;

    constructor(
        private fb: FormBuilder,
        private groupsService: GroupsService,
        public dialogRef: MatDialogRef<GroupFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: Groupe | null
    ) {
        this.isEditMode = !!data;
        this.form = this.fb.group({
            nom: [data?.nom || '', Validators.required],
            description: [data?.description || ''],
            adresse: [data?.adresse || ''],
            telephone: [data?.telephone || ''],
            email: [data?.email || '', Validators.email],
        });
    }

    ngOnInit(): void { }

    onSubmit(): void {
        if (this.form.valid) {
            const formData = this.form.value;

            if (this.isEditMode && this.data?.id) {
                this.groupsService.update(this.data.id, formData).subscribe({
                    next: () => {
                        this.dialogRef.close(true);
                    },
                    error: (err) => {
                        console.error('Error updating group:', err);
                        alert('Erreur lors de la mise à jour du groupe');
                    }
                });
            } else {
                this.groupsService.create(formData).subscribe({
                    next: () => {
                        this.dialogRef.close(true);
                    },
                    error: (err) => {
                        console.error('Error creating group:', err);
                        alert('Erreur lors de la création du groupe');
                    }
                });
            }
        }
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
