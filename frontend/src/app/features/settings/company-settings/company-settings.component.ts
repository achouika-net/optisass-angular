import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { BankAccount, CompanySettings } from '../../../shared/interfaces/company-settings.interface';

@Component({
    selector: 'app-company-settings',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        MatDividerModule,
        MatTabsModule
    ],
    templateUrl: './company-settings.component.html',
    styleUrls: ['./company-settings.component.scss']
})
export class CompanySettingsComponent implements OnInit {
    private fb = inject(FormBuilder);
    private service = inject(CompanySettingsService);
    private snackBar = inject(MatSnackBar);

    settingsForm: FormGroup;
    loading = false;
    logoPreview: string | null = null;
    cachetPreview: string | null = null;

    constructor() {
        this.settingsForm = this.fb.group({
            name: ['', Validators.required],
            address: [''],
            phone: [''],
            email: ['', Validators.email],
            ice: [''],
            identifiantFiscal: [''],
            rc: [''],
            patente: [''],
            cnss: [''],
            inpeCode: [''],
            headerText: [''],
            footerText: [''],
            bankAccounts: this.fb.array([])
        });
    }

    ngOnInit(): void {
        this.loadSettings();
    }

    get bankAccounts(): FormArray {
        return this.settingsForm.get('bankAccounts') as FormArray;
    }

    addBankAccount(bank: BankAccount = { bankName: '', rib: '', iban: '', swift: '' }): void {
        this.bankAccounts.push(this.fb.group({
            bankName: [bank.bankName || ''],
            rib: [bank.rib || ''],
            iban: [bank.iban || ''],
            swift: [bank.swift || '']
        }));
    }

    removeBankAccount(index: number): void {
        this.bankAccounts.removeAt(index);
    }

    loadSettings(): void {
        this.loading = true;
        this.service.getSettings().subscribe({
            next: (settings: CompanySettings) => {
                this.settingsForm.patchValue(settings);
                this.logoPreview = settings.logoUrl || null;
                this.cachetPreview = settings.cachetUrl || null;

                // Load bank accounts
                this.bankAccounts.clear();
                if (settings.bankAccounts && Array.isArray(settings.bankAccounts)) {
                    settings.bankAccounts.forEach((bank: BankAccount) => this.addBankAccount(bank));
                }
                if (this.bankAccounts.length === 0) {
                    this.addBankAccount(); // Add at least one empty row
                }

                this.loading = false;
            },
            error: (err: Error) => {
                console.error('Error loading company settings', err);
                this.snackBar.open('Erreur lors du chargement des paramètres', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    onLogoChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                this.logoPreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    onCachetChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                this.cachetPreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    saveSettings(): void {
        if (this.settingsForm.invalid) return;

        this.loading = true;
        const data: Partial<CompanySettings> = {
            ...this.settingsForm.value,
            logoUrl: this.logoPreview ?? undefined,
            cachetUrl: this.cachetPreview ?? undefined
        };

        this.service.updateSettings(data).subscribe({
            next: () => {
                this.snackBar.open('Paramètres enregistrés avec succès', 'Fermer', { duration: 3000 });
                this.loading = false;
            },
            error: (err: Error) => {
                console.error('Error saving company settings', err);
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }
}
