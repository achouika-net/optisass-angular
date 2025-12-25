import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import { Expense } from '../../models/finance.models';
// import { CentersService } from '../../../centers/services/centers.service'; // Je commenterai si le path est pas sûr, mais je vais essayer de le faire marcher
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

// Je préfère utiliser un service dédié ou fetch via http direct si je n'ai pas le service sous la main.
// Pour rester simple, je vais faire un fetch via HttpClient ici ou supposer que CentersService est accessible.
// Le chemin relatif vers CentersService est `../../../centers/services/centers.service`.

@Component({
    selector: 'app-expense-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatIconModule
    ],
    templateUrl: './expense-form-dialog.component.html',
    styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; margin-bottom: 8px; }
    .col { flex: 1; }
  `]
})
export class ExpenseFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode: boolean;
    centers: any[] = []; // Liste des centres simplifiée

    categories = ['LOYER', 'ELECTRICITE', 'EAU', 'INTERNET', 'TELEPHONE', 'SALAIRE', 'ACHAT_MARCHANDISE', 'TRANSPORT', 'REPAS', 'AUTRE'];
    paymentMethods = ['ESPECES', 'CHEQUE', 'VIREMENT', 'CARTE'];

    constructor(
        private fb: FormBuilder,
        private http: HttpClient, // Injection directe pour charger les centres rapidement
        private dialogRef: MatDialogRef<ExpenseFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { expense?: Expense }
    ) {
        this.isEditMode = !!data.expense;
        this.form = this.fb.group({
            date: [data.expense?.date || new Date(), Validators.required],
            montant: [data.expense?.montant || '', [Validators.required, Validators.min(0)]],
            categorie: [data.expense?.categorie || '', Validators.required],
            modePaiement: [data.expense?.modePaiement || 'ESPECES', Validators.required],
            centreId: [data.expense?.centreId || '', Validators.required],
            description: [data.expense?.description || ''],
            statut: [data.expense?.statut || 'VALIDEE']
        });
    }

    ngOnInit() {
        this.loadCenters();
    }

    loadCenters() {
        this.http.get<any[]>(`${environment.apiUrl}/centers`).subscribe({
            next: (data) => {
                this.centers = data;
                // Si un seul centre, on le sélectionne par défaut
                if (!this.isEditMode && this.centers.length === 1) {
                    this.form.patchValue({ centreId: this.centers[0].id });
                }
            },
            error: (err) => console.error('Erreur chargement centres', err)
        });
    }

    onSubmit() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }

    onCancel() {
        this.dialogRef.close();
    }
}
