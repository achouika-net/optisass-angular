
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
    selector: 'app-invoice-return-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule
    ],
    templateUrl: './invoice-return-dialog.component.html',
    styleUrls: ['./invoice-return-dialog.component.scss']
})
export class InvoiceReturnDialogComponent implements OnInit {
    form: FormGroup;
    selectedItems: Set<number> = new Set();

    // Controls for quantities of each item
    quantityControls: FormControl[] = [];

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<InvoiceReturnDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { facture: any }
    ) {
        this.form = this.fb.group({
            reason: ['DEFECTUEUX', Validators.required]
        });
    }

    ngOnInit() {
        // Initialize quantity controls for each line item
        if (this.data.facture?.lignes) {
            // Safety parse if string (sometimes happens with Json fields depending on driver/context)
            const lines = typeof this.data.facture.lignes === 'string'
                ? JSON.parse(this.data.facture.lignes)
                : this.data.facture.lignes;

            this.data.facture.lignes = lines;

            lines.forEach((line: any) => {
                this.quantityControls.push(new FormControl(line.qte || 1, [
                    Validators.required,
                    Validators.min(1),
                    Validators.max(line.qte || 99)
                ]));
            });
        }
    }

    getQuantityControl(index: number): FormControl {
        return this.quantityControls[index];
    }

    isSelected(index: number): boolean {
        return this.selectedItems.has(index);
    }

    toggleSelection(index: number) {
        if (this.selectedItems.has(index)) {
            this.selectedItems.delete(index);
        } else {
            this.selectedItems.add(index);
        }
    }

    cancel() {
        this.dialogRef.close();
    }

    confirm() {
        if (this.form.invalid || this.selectedItems.size === 0) return;

        const itemsToReturn = Array.from(this.selectedItems).map(index => ({
            lineIndex: index,
            quantiteRetour: this.quantityControls[index].value,
            originalLine: this.data.facture.lignes[index]
        }));

        this.dialogRef.close({
            reason: this.form.get('reason')?.value,
            items: itemsToReturn
        });
    }
}
