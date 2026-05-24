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
import { HttpClient } from '@angular/common/http';
import { CompanySettingsService } from '../../../core/services/company-settings.service';
import { CompanySettings } from '../../../shared/interfaces/company-settings.interface';
import { environment } from '../../../../environments/environment';

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
    private http = inject(HttpClient);

    settingsForm: FormGroup;
    loading = false;
    logoPreview: string | null = null;
    cachetPreview: string | null = null;
    deletedAccountIds: string[] = [];

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

    addBankAccount(bank: any = { id: '', nom: '', banque: '', numeroCompte: '', type: 'STE' }): void {
        this.bankAccounts.push(this.fb.group({
            id: [bank.id || ''],
            nom: [bank.nom || '', Validators.required],
            banque: [bank.banque || '', Validators.required],
            numeroCompte: [bank.numeroCompte || ''],
            type: [bank.type || 'STE']
        }));
    }

    removeBankAccount(index: number): void {
        const id = this.bankAccounts.at(index).value.id;
        if (id) {
            this.deletedAccountIds.push(id);
        }
        this.bankAccounts.removeAt(index);
    }

    loadSettings(): void {
        this.loading = true;
        this.service.getSettings().subscribe({
            next: (settings: CompanySettings) => {
                this.settingsForm.patchValue(settings);
                this.logoPreview = settings.logoUrl || null;
                this.cachetPreview = settings.cachetUrl || null;

                // Load bank accounts from banque module
                this.http.get<any[]>(`${environment.apiUrl}/api/banque/comptes`).subscribe({
                    next: (comptes) => {
                        this.bankAccounts.clear();
                        this.deletedAccountIds = [];
                        
                        if (comptes && comptes.length > 0) {
                            comptes.forEach(compte => this.addBankAccount(compte));
                        } else {
                            this.addBankAccount(); // Add at least one empty row
                        }
                        this.loading = false;
                    },
                    error: (err) => {
                        console.error('Error loading bank accounts', err);
                        this.loading = false;
                    }
                });
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

        // Remove bankAccounts from settings payload
        delete data.bankAccounts;

        this.service.updateSettings(data).subscribe({
            next: () => {
                const saveOps = [];

                // 1. Delete removed accounts
                for (const delId of this.deletedAccountIds) {
                    saveOps.push(this.http.delete(`${environment.apiUrl}/api/banque/comptes/${delId}`));
                }

                // 2. Save / Update current accounts
                const currentAccounts = this.bankAccounts.value;
                for (const account of currentAccounts) {
                    if (!account.nom || !account.banque) continue;

                    if (account.id) {
                        saveOps.push(this.http.patch(`${environment.apiUrl}/api/banque/comptes/${account.id}`, account));
                    } else {
                        saveOps.push(this.http.post(`${environment.apiUrl}/api/banque/comptes`, {
                            ...account,
                            soldeInitial: 0,
                            soldeActuel: 0
                        }));
                    }
                }

                if (saveOps.length > 0) {
                    let completed = 0;
                    saveOps.forEach(op => {
                        op.subscribe({
                            next: () => {
                                completed++;
                                if (completed === saveOps.length) {
                                    this.snackBar.open('Paramètres et comptes bancaires enregistrés avec succès', 'Fermer', { duration: 3000 });
                                    this.loadSettings();
                                }
                            },
                            error: (err) => {
                                console.error('Error saving bank account', err);
                                completed++;
                                if (completed === saveOps.length) {
                                    this.snackBar.open('Paramètres enregistrés (erreur sur certains comptes)', 'Fermer', { duration: 3000 });
                                    this.loadSettings();
                                }
                            }
                        });
                    });
                } else {
                    this.snackBar.open('Paramètres enregistrés avec succès', 'Fermer', { duration: 3000 });
                    this.loadSettings();
                }
            },
            error: (err: Error) => {
                console.error('Error saving company settings', err);
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }
}
