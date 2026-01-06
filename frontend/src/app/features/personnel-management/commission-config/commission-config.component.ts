import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { PersonnelService } from '../services/personnel.service';
import { CommissionRule } from '../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-commission-config',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatTableModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatFormFieldModule,
        MatSnackBarModule
    ],
    templateUrl: './commission-config.component.html',
    styles: [`
        .container { padding: 20px; }
        .form-card { margin-bottom: 20px; }
        .full-width { width: 100%; }
        table { width: 100%; }
    `]
})
export class CommissionConfigComponent implements OnInit {
    rules: CommissionRule[] = [];
    displayedColumns: string[] = ['poste', 'typeProduit', 'taux', 'actions'];
    commissionForm: FormGroup;

    isEditMode = false;
    editingId?: string;

    postes = ['OPTICIEN', 'VENDEUR', 'CAISSIER', 'RESPONSABLE'];
    typesProduit = ['MONTURE', 'VERRE', 'LENTILLE', 'ACCESSOIRE'];

    constructor(
        private personnelService: PersonnelService,
        private fb: FormBuilder,
        private snackBar: MatSnackBar
    ) {
        this.commissionForm = this.fb.group({
            poste: ['', Validators.required],
            typeProduit: ['', Validators.required],
            taux: [null, [Validators.required, Validators.min(0), Validators.max(100)]]
        });
    }

    ngOnInit(): void {
        this.loadRules();
    }

    loadRules(): void {
        this.personnelService.getCommissionRules().subscribe({
            next: (data) => this.rules = data,
            error: (err) => console.error('Error loading rules', err)
        });
    }

    onSubmit(): void {
        if (this.commissionForm.valid) {
            const formValue = this.commissionForm.value;

            if (this.isEditMode && this.editingId) {
                this.personnelService.updateCommissionRule(this.editingId, formValue).subscribe({
                    next: () => {
                        this.loadRules();
                        this.resetForm();
                        this.snackBar.open('Règle modifiée avec succès', 'OK', { duration: 3000 });
                    },
                    error: (err) => {
                        console.error('Error updating rule', err);
                        this.snackBar.open('Erreur lors de la modification', 'Fermer', { duration: 3000 });
                    }
                });
            } else {
                this.personnelService.createCommissionRule(formValue).subscribe({
                    next: (rule) => {
                        this.rules = [...this.rules, rule];
                        this.resetForm();
                        this.snackBar.open('Règle ajoutée avec succès', 'OK', { duration: 3000 });
                    },
                    error: (err) => {
                        console.error('Error creating rule', err);
                        this.snackBar.open('Erreur lors de la création', 'Fermer', { duration: 3000 });
                    }
                });
            }
        }
    }

    editRule(rule: CommissionRule): void {
        this.isEditMode = true;
        this.editingId = rule.id;
        this.commissionForm.patchValue({
            poste: rule.poste,
            typeProduit: rule.typeProduit,
            taux: rule.taux
        });
    }

    deleteRule(rule: CommissionRule): void {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) {
            this.personnelService.deleteCommissionRule(rule.id!).subscribe({
                next: () => {
                    this.rules = this.rules.filter(r => r.id !== rule.id);
                    this.snackBar.open('Règle supprimée', 'OK', { duration: 3000 });
                },
                error: (err) => {
                    console.error('Error deleting rule', err);
                    this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
                }
            });
        }
    }

    cancelEdit(): void {
        this.resetForm();
    }

    private resetForm(): void {
        this.commissionForm.reset();
        this.isEditMode = false;
        this.editingId = undefined;
        Object.keys(this.commissionForm.controls).forEach(key => {
            this.commissionForm.get(key)?.setErrors(null);
        });
    }
}
