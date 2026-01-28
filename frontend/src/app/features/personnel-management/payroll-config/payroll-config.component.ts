import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PersonnelService } from '../services/personnel.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
    selector: 'app-payroll-config',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        MatExpansionModule,
        MatTabsModule
    ],
    templateUrl: './payroll-config.component.html',
    styles: [`
        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.5rem;
        }
    `]
})
export class PayrollConfigComponent implements OnInit {
    configForm: FormGroup;
    isLoading = false;
    currentAnnee = new Date().getFullYear();
    configId?: string;
    isReadOnly = true;

    private fb = inject(FormBuilder);
    private personnelService = inject(PersonnelService);
    private snackBar = inject(MatSnackBar);

    constructor() {
        this.configForm = this.fb.group({
            annee: [this.currentAnnee, [Validators.required]],
            socialSecurityRate_S: [0, [Validators.required]],
            socialSecurityRate_P: [0, [Validators.required]],
            familyAllowanceRate_P: [0, [Validators.required]],
            trainingRate_P: [0, [Validators.required]],
            socialSecurityCap: [0, [Validators.required]],
            healthInsuranceRate_S: [0, [Validators.required]],
            healthInsuranceRate_P: [0, [Validators.required]],
            profExpensesRate: [0, [Validators.required]],
            profExpensesCap: [0, [Validators.required]],
            familyDeduction: [0, [Validators.required]],
            incomeTaxBrackets: [[]]
        });
    }

    ngOnInit(): void {
        this.loadConfig(this.currentAnnee);
    }

    loadConfig(annee: number): void {
        this.isLoading = true;
        this.configId = undefined; // Reset ID first
        this.personnelService.getPayrollConfig(annee).subscribe({
            next: (config) => {
                if (config) {
                    this.configId = config.id;
                    this.configForm.patchValue(config);
                    this.isReadOnly = true;
                    this.configForm.disable();
                } else {
                    this.isReadOnly = false;
                    this.configForm.enable();
                    // Start fresh for this year with Moroccan standards
                    const is2025OrMore = annee >= 2025;
                    this.configForm.reset({
                        annee: annee,
                        socialSecurityRate_S: 4.48,
                        socialSecurityRate_P: 8.98,
                        familyAllowanceRate_P: 6.40,
                        trainingRate_P: 1.60,
                        socialSecurityCap: 6000,
                        healthInsuranceRate_S: 2.26,
                        healthInsuranceRate_P: 4.11,
                        profExpensesRate: 20,
                        profExpensesCap: 2500,
                        familyDeduction: 30,
                        incomeTaxBrackets: is2025OrMore ? [
                            { min: 0, max: 3333.33, rate: 0, deduction: 0 },
                            { min: 3333.34, max: 5000, rate: 10, deduction: 333.33 },
                            { min: 5000.01, max: 6666.67, rate: 20, deduction: 833.33 },
                            { min: 6666.68, max: 8333.33, rate: 30, deduction: 1500 },
                            { min: 8333.34, max: 15000, rate: 34, deduction: 1833.33 },
                            { min: 15000.01, max: null, rate: 37, deduction: 2283.33 }
                        ] : [
                            { min: 0, max: 2500, rate: 0, deduction: 0 },
                            { min: 2501, max: 4166.67, rate: 10, deduction: 250 },
                            { min: 4166.68, max: 5000, rate: 20, deduction: 666.67 },
                            { min: 5000.01, max: 6666.67, rate: 30, deduction: 1166.67 },
                            { min: 6666.68, max: 15000, rate: 34, deduction: 1433.33 },
                            { min: 15000.01, max: null, rate: 38, deduction: 2033.33 }
                        ]
                    });
                }
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                // Don't show error if it's just a 404, just let the user create it
            }
        });
    }

    saveConfig(): void {
        if (this.configForm.invalid) return;

        this.isLoading = true;
        // Use getRawValue because the form might be disabled
        const { id, createdAt, updatedAt, ...formData } = this.configForm.getRawValue();
        const data = {
            ...formData,
            annee: parseInt(formData.annee),
            incomeTaxBrackets: formData.incomeTaxBrackets || []
        };

        const action = this.configId ?
            this.personnelService.updatePayrollConfig(this.configId, data) :
            this.personnelService.createPayrollConfig(data);

        action.subscribe({
            next: (res) => {
                this.configId = res.id;
                this.isLoading = false;
                this.isReadOnly = true;
                this.configForm.disable();
                this.snackBar.open('Configuration enregistrée avec succès', 'OK', { duration: 3000 });
            },
            error: (err) => {
                console.error('Config save error:', err);
                this.isLoading = false;
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
            }
        });
    }

    unlockForm(): void {
        this.isReadOnly = false;
        this.configForm.enable();
    }

    autoFillWithAI(): void {
        this.isLoading = true;
        const annee = this.currentAnnee;
        const is2025OrMore = annee >= 2025;

        this.snackBar.open(`Analyse des barèmes officiels pour ${annee}...`, 'OK', { duration: 2000 });

        setTimeout(() => {
            this.configForm.patchValue({
                socialSecurityRate_S: 4.48,
                socialSecurityRate_P: 8.98,
                familyAllowanceRate_P: 6.40,
                trainingRate_P: 1.60,
                socialSecurityCap: 6000,
                healthInsuranceRate_S: 2.26,
                healthInsuranceRate_P: 4.11,
                profExpensesRate: 20,
                profExpensesCap: 2500,
                familyDeduction: 30,
                incomeTaxBrackets: is2025OrMore ? [
                    { min: 0, max: 3333.33, rate: 0, deduction: 0 },
                    { min: 3333.34, max: 5000, rate: 10, deduction: 333.33 },
                    { min: 5000.01, max: 6666.67, rate: 20, deduction: 833.33 },
                    { min: 6666.68, max: 8333.33, rate: 30, deduction: 1500 },
                    { min: 8333.34, max: 15000, rate: 34, deduction: 1833.33 },
                    { min: 15000.01, max: null, rate: 37, deduction: 2283.33 }
                ] : [
                    { min: 0, max: 2500, rate: 0, deduction: 0 },
                    { min: 2501, max: 4166.67, rate: 10, deduction: 250 },
                    { min: 4166.68, max: 5000, rate: 20, deduction: 666.67 },
                    { min: 5000.01, max: 6666.67, rate: 30, deduction: 1166.67 },
                    { min: 6666.68, max: 15000, rate: 34, deduction: 1433.33 },
                    { min: 15000.01, max: null, rate: 38, deduction: 2033.33 }
                ]
            });
            this.isLoading = false;
            this.snackBar.open(`Barèmes ${annee} chargés avec succès via IA`, 'OK', { duration: 3000 });
        }, 1500);
    }
}
