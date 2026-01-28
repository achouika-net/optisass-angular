import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Payroll } from '../../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-edit-payroll-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule
    ],
    templateUrl: './edit-payroll-dialog.component.html'
})
export class EditPayrollDialogComponent {
    form: FormGroup;

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<EditPayrollDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: Payroll
    ) {
        this.form = this.fb.group({
            salaireBase: [data.salaireBase, [Validators.required, Validators.min(0)]],
            commissions: [data.commissions, [Validators.required, Validators.min(0)]],
            heuresSup: [data.heuresSup, [Validators.min(0)]],
            primes: [data.primes || 0, [Validators.min(0)]],
            retenues: [data.retenues, [Validators.min(0)]],
            avances: [data.avances || 0, [Validators.min(0)]]
        });
    }

    onSubmit(): void {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
