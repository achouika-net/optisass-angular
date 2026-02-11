import { Component, Inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { FinanceService } from '../../services/finance.service';
import { Optional } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { CeilingWarningDialogComponent } from '../ceiling-warning-dialog/ceiling-warning-dialog.component';

import { Expense, Supplier } from '../../models/finance.models';
import { HttpClient } from '@angular/common/http';
import { CentersService } from '../../../centers/services/centers.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

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
        MatIconModule,
        MatCardModule,
        MatProgressBarModule,
        MatAutocompleteModule,
        MatSnackBarModule
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
    isViewMode: boolean = false;
    submitting = false;
    centers: any[] = [];
    suppliers: Supplier[] = [];

    categories = [
        'ACHAT_VERRE_OPTIQUE', 'ACHAT_MONTURES_OPTIQUE', 'ACHAT_MONTURES_SOLAIRE',
        'ACHAT_LENTILLES', 'ACHAT_PRODUITS', 'COTISATION_AMO_CNSS',
        'LOYER', 'ELECTRICITE', 'EAU', 'INTERNET', 'TELEPHONE', 'SALAIRE',
        'ACHAT_MARCHANDISE', 'TRANSPORT', 'REPAS', 'AUTRE'
    ];
    filteredCategories!: Observable<string[]>;

    // Supplier Autocomplete
    supplierCtrl = new FormControl('');
    filteredSuppliers!: Observable<Supplier[]>;
    paymentMethods = ['ESPECES', 'CHEQUE', 'LCN', 'VIREMENT', 'CARTE'];

    constructor(
        private fb: FormBuilder,
        private centersService: CentersService,
        private financeService: FinanceService,
        private route: ActivatedRoute,
        private router: Router,
        private zone: NgZone,
        private store: Store,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        @Optional() public dialogRef: MatDialogRef<ExpenseFormDialogComponent>,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: { expense?: Expense, viewMode?: boolean }
    ) {
        this.isEditMode = !!(data?.expense?.id);
        this.isViewMode = !!(data?.viewMode);

        // Get current center from store
        const currentCentre = this.store.selectSignal(UserCurrentCentreSelector)();

        this.form = this.fb.group({
            date: [data?.expense?.date || new Date(), Validators.required],
            montant: [data?.expense?.montant || '', [Validators.required, Validators.min(0)]],
            categorie: [data?.expense?.categorie || '', Validators.required],
            modePaiement: [data?.expense?.modePaiement || 'ESPECES', Validators.required],
            centreId: [data?.expense?.centreId || currentCentre?.id || '', Validators.required],
            description: [data?.expense?.description || ''],
            statut: [data?.expense?.statut || 'VALIDEE'],
            reference: [data?.expense?.reference || ''],
            banque: [data?.expense?.banque || ''],
            dateEcheance: [data?.expense?.dateEcheance || null],
            fournisseurId: [data?.expense?.fournisseurId || null],
            factureFournisseurId: [(data?.expense as any)?.factureFournisseurId || null],
            echeanceId: [(data?.expense as any)?.echeanceId || null]
        });
    }

    ngOnInit() {
        this.loadCenters();
        this.loadSuppliers();

        this.filteredCategories = this.form.get('categorie')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filterCategories(value || ''))
        );

        if (this.isViewMode) {
            this.form.disable();
        }

        this.route.queryParams.subscribe(params => {
            if (params['viewMode'] === 'true') {
                this.isViewMode = true;
                this.form.disable();
            }
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            // Assuming we have a getExpense in service, if not I'll just use what's available
            // but for now let's hope it's there or I use this.data
            if (this.data?.expense) {
                this.form.patchValue(this.data.expense);
            }
        }
    }

    loadCenters() {
        this.centersService.findAll().subscribe({
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

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe({
            next: (data) => {
                this.suppliers = data;
                this.setupSupplierFilter();

                // If editing and has provider
                const currentId = this.form.get('fournisseurId')?.value;
                if (currentId) {
                    const s = this.suppliers.find(x => x.id === currentId);
                    if (s) this.supplierCtrl.setValue(s.nom); // OR set object if using displayWith
                }
            },
            error: (err) => console.error('Erreur chargement fournisseurs', err)
        });
    }

    setupSupplierFilter() {
        this.filteredSuppliers = this.supplierCtrl.valueChanges.pipe(
            startWith(''),
            map(value => {
                const name = typeof value === 'string' ? value : (value as any)?.nom;
                return name ? this._filterSuppliers(name as string) : this.suppliers.slice();
            })
        );
    }

    private _filterSuppliers(name: string): Supplier[] {
        const filterValue = name.toLowerCase();
        return this.suppliers.filter((option: Supplier) => option.nom.toLowerCase().includes(filterValue));
    }

    private _filterCategories(value: string): string[] {
        const filterValue = value.toLowerCase();
        return this.categories.filter(option => option.toLowerCase().includes(filterValue));
    }

    onSubmit() {
        if (this.form.valid) {
            this.submitting = true;
            this.handleSupplierAndSave();
        } else {
            this.form.markAllAsTouched();
        }
    }

    private handleSupplierAndSave() {
        const supplierInput = this.supplierCtrl.value;
        // If empty, proceed without supplier
        if (!supplierInput) {
            this.form.patchValue({ fournisseurId: null });
            this.saveExpense();
            return;
        }

        // Check if selected existing
        if (typeof supplierInput === 'object' && supplierInput && 'id' in supplierInput) {
            const s = supplierInput as Supplier;
            this.form.patchValue({ fournisseurId: s.id });
            this.saveExpense();
            return;
        }

        // It is a string
        const name = String(supplierInput);
        // Check if it matches an existing one by name (case insensitive)
        const existing = this.suppliers.find(s => s.nom.toLowerCase() === name.toLowerCase());
        if (existing) {
            this.form.patchValue({ fournisseurId: existing.id });
            this.saveExpense();
            return;
        }

        // Creating new supplier
        this.financeService.createSupplier({ nom: name }).subscribe({
            next: (newSupplier) => {
                this.form.patchValue({ fournisseurId: newSupplier.id });
                this.saveExpense();
            },
            error: (err) => {
                console.error('Error creating supplier', err);
                this.submitting = false; // Stop on error
                this.snackBar.open(this.getErrorMessage(err) || 'Erreur lors de la création du fournisseur', 'Fermer', { duration: 5000 });
            }
        });
    }

    private saveExpense() {
        const formValue = this.form.value;
        const expenseData = {
            ...formValue,
            montant: Number(formValue.montant),
            fournisseurId: formValue.fournisseurId || null,
            factureFournisseurId: formValue.factureFournisseurId || null,
            echeanceId: formValue.echeanceId || null,
            centreId: formValue.centreId || null
        };

        if (this.isEditMode) {
            const id = this.route.snapshot.paramMap.get('id') || this.data?.expense?.id;
            if (id) {
                this.financeService.updateExpense(id, expenseData).subscribe({
                    next: () => this.finalize(expenseData),
                    error: (err) => {
                        this.submitting = false;
                        const msg = this.getErrorMessage(err);
                        this.snackBar.open(msg || 'Erreur lors de la mise à jour', 'Fermer', { duration: 7000 });
                    }
                });
            } else {
                this.createExpenseWithCeilingCheck(expenseData);
            }
        } else {
            this.createExpenseWithCeilingCheck(expenseData);
        }
    }

    private createExpenseWithCeilingCheck(expenseData: any) {
        const expenseDate = new Date(expenseData.date);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // ceiling check if is current month
        if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear && expenseData.centreId) {
            this.financeService.getTreasurySummary(currentYear, currentMonth + 1, expenseData.centreId).pipe(
                switchMap(summary => {
                    const threshold = summary?.monthlyThreshold || 50000;
                    const totalWithEntry = (summary?.totalExpenses || 0) + expenseData.montant;

                    if (totalWithEntry > threshold) {
                        return this.financeService.getYearlyProjection(currentYear, expenseData.centreId).pipe(
                            switchMap(projection => {
                                const dialogRef = this.dialog.open(CeilingWarningDialogComponent, {
                                    width: '600px',
                                    disableClose: true,
                                    data: {
                                        amount: expenseData.montant,
                                        currentDetails: {
                                            totalExpenses: summary.totalExpenses,
                                            monthlyThreshold: threshold,
                                            balance: summary.balance
                                        },
                                        projection: projection,
                                        currentMonth: currentMonth,
                                        currentYear: currentYear
                                    }
                                });
                                return dialogRef.afterClosed();
                            })
                        );
                    }
                    return of({ action: 'FORCE' });
                })
            ).subscribe((result: any) => {
                if (!result || result.action === 'CANCEL') {
                    this.submitting = false;
                    return;
                }

                if (result.action === 'RESCHEDULE' && result.date) {
                    expenseData.date = result.date;
                    // Also update dateEcheance if it exists to ensure treasury views reflect the new month
                    expenseData.dateEcheance = result.date;
                }

                this.performCreateExpense(expenseData);
            });
        } else {
            this.performCreateExpense(expenseData);
        }
    }

    private performCreateExpense(expenseData: any) {
        this.financeService.createExpense(expenseData).subscribe({
            next: res => this.finalize(res),
            error: (err) => {
                this.submitting = false;
                const msg = this.getErrorMessage(err);
                this.snackBar.open(msg || 'Erreur lors de la création', 'Fermer', { duration: 7000 });
            }
        });
    }
    private getErrorMessage(err: any): string {
        console.error('Error details:', err);
        if (!err) return 'Une erreur inconnue est survenue';

        if (typeof err.error === 'string') return err.error;
        if (err.error && typeof err.error.message === 'string') return err.error.message;
        if (err.error && Array.isArray(err.error.message)) return err.error.message.join(', ');
        if (err.message) return err.message;

        return JSON.stringify(err);
    }

    private finalize(result: any) {
        this.zone.run(() => {
            this.submitting = false;
            if (this.dialogRef) {
                this.dialogRef.close(result);
            } else {
                this.router.navigate(['/p/finance/expenses']);
            }
        });
    }

    onCancel() {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/p/finance/payments']);
        }
    }

    get showEcheance(): boolean {
        const mode = this.form.get('modePaiement')?.value;
        return mode === 'CHEQUE' || mode === 'LCN';
    }

    get showReference(): boolean {
        const mode = this.form.get('modePaiement')?.value;
        return mode === 'CHEQUE' || mode === 'LCN' || mode === 'CARTE';
    }

    displayFn(supplier: Supplier): string {
        return supplier && supplier.nom ? supplier.nom : '';
    }
}
