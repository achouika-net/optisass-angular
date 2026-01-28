import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Employee } from '../../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-record-advance-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule
    ],
    templateUrl: './record-advance-dialog.component.html'
})
export class RecordAdvanceDialogComponent {
    form: FormGroup;

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<RecordAdvanceDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { employees: Employee[], selectedEmployeeId?: string }
    ) {
        this.form = this.fb.group({
            employeeId: [data.selectedEmployeeId || '', Validators.required],
            amount: [null, [Validators.required, Validators.min(1)]],
            mode: ['ESPECES', Validators.required]
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
