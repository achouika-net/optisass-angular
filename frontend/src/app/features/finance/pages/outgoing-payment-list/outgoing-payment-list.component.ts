import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';

import { FinanceService } from '../../services/finance.service';
import { Supplier } from '../../models/finance.models';
import { InvoiceFormDialogComponent } from '../../components/invoice-form-dialog/invoice-form-dialog.component';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog.component';

@Component({
    selector: 'app-outgoing-payment-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatChipsModule,
        MatSelectModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressBarModule,
        MatMenuModule,
        MatDividerModule,
        MatDialogModule,
        MatTabsModule,
        RouterModule
    ],
    templateUrl: './outgoing-payment-list.component.html',
    styles: [`
    .container { 
      width: 100%;
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 24px;
      box-sizing: border-box;
    }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .filters { 
      display: flex; 
      gap: 16px; 
      align-items: center;
      width: 100%;
    }
    .filters mat-form-field {
      flex: 1;
      min-width: 0;
    }
    table { width: 100%; }
    .montant-cell { font-weight: bold; text-align: right; }
    .source-chip { font-size: 10px; height: 20px; }
    ::ng-deep .filters .mat-mdc-form-field-wrapper { width: 100%; }
    ::ng-deep .filters .mat-mdc-text-field-wrapper { width: 100%; }
  `]
})
export class OutgoingPaymentListComponent implements OnInit {
    payments: any[] = [];
    activeTab: 'OUTGOING' | 'INCOMING' = 'OUTGOING';

    get displayedColumns(): string[] {
        const base = ['date', 'source', 'libelle', 'type'];
        const middle = this.activeTab === 'OUTGOING' ? 'fournisseur' : 'client';
        return [...base, middle, 'montant', 'statut', 'actions'];
    }

    loading = false;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    suppliers: Supplier[] = [];
    types: string[] = [
        'LOYER', 'ELECTRICITE', 'EAU', 'INTERNET', 'TELEPHONE', 'SALAIRE',
        'ACHAT_MARCHANDISE', 'TRANSPORT', 'REPAS', 'AUTRE',
        'ACHAT_STOCK', 'FRAIS_GENERAUX', 'IMMOBILISATION'
    ];

    filters = {
        fournisseurId: '',
        type: '',
        source: '',
        startDate: '',
        endDate: '',
        centreId: ''
    };

    constructor(
        private financeService: FinanceService,
        private router: Router,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private store: Store
    ) {
        // Automatically reload when center changes
        effect(() => {
            const center = this.currentCentre();
            if (center?.id) {
                console.log(`[PAYMENTS-SYNC] Center detected: ${center.id}, triggering load...`);
                this.filters.centreId = center.id;
                this.loadPayments();
            }
        });
    }

    ngOnInit(): void {
        this.loadSuppliers();

        // Fallback: If center is already set but effect hasn't triggered yet
        const currentCenter = this.currentCentre();
        if (currentCenter?.id && !this.filters.centreId) {
            console.log(`[PAYMENTS-INIT] Center already set: ${currentCenter.id}, loading payments...`);
            this.filters.centreId = currentCenter.id;
            this.loadPayments();
        }
    }

    openInvoiceDialog() {
        const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
            width: '1000px',
            maxWidth: '95vw',
            height: '90vh',
            data: {}
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadPayments();
            }
        });
    }

    openExpenseDialog() {
        const dialogRef = this.dialog.open(ExpenseFormDialogComponent, {
            width: '800px',
            maxWidth: '95vw',
            data: {}
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadPayments();
            }
        });
    }

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe(data => this.suppliers = data);
    }

    onTabChange(event: any) {
        this.activeTab = event.index === 0 ? 'OUTGOING' : 'INCOMING';
        this.loadPayments();
    }

    loadPayments() {
        this.loading = true;
        console.log(`[PAYMENTS-LOAD] Loading ${this.activeTab} payments with filters:`, this.filters);

        const request = this.activeTab === 'OUTGOING'
            ? this.financeService.getConsolidatedOutgoings(this.filters)
            : this.financeService.getConsolidatedIncomings(this.filters);

        request.subscribe({
            next: (data) => {
                console.log(`[PAYMENTS-LOAD] Received ${data.length} ${this.activeTab} payments`);
                this.payments = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('[PAYMENTS-LOAD] Error loading payments:', err);
                this.snackBar.open('Erreur lors du chargement des paiements', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    applyFilters() {
        this.loadPayments();
    }

    resetFilters() {
        this.filters = {
            fournisseurId: '',
            type: '',
            source: '',
            startDate: '',
            endDate: '',
            centreId: this.currentCentre()?.id || ''
        };
        this.loadPayments();
    }

    viewDetail(payment: any, viewMode: boolean = false) {
        if (payment.source === 'FACTURE_CLIENT') {
            // Navigate to Client Invoice page
            this.router.navigate(['/p/clients/factures', payment.factureId], { queryParams: { mode: 'view' } });
            return;
        }

        if (payment.source === 'FACTURE') {
            this.financeService.getInvoice(payment.id).subscribe(invoice => {
                const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
                    width: '1000px',
                    maxWidth: '95vw',
                    height: '90vh',
                    data: {
                        invoice: {
                            ...invoice,
                            viewMode // Passing it in data too if component supports it, or handle in component
                        }
                    }
                });

                // Force viewMode if component uses route params, but since we open as dialog
                // we should ensure the component handled the viewMode from data.
                // I previously added viewMode query param support, need to ensure data support too.

                dialogRef.afterClosed().subscribe(result => {
                    if (result && !viewMode) {
                        this.loadPayments();
                    }
                });
            });
        } else {
            // Expenses
            this.financeService.getExpense(payment.id).subscribe(expense => {
                const dialogRef = this.dialog.open(ExpenseFormDialogComponent, {
                    width: '800px',
                    maxWidth: '95vw',
                    data: { expense, viewMode }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if (result && !viewMode) {
                        this.loadPayments();
                    }
                });
            });
        }
    }

    deletePayment(payment: any, event: Event) {
        event.stopPropagation();
        if (confirm(`Êtes-vous sûr de vouloir supprimer ce paiement (${payment.source === 'FACTURE' ? 'Facture' : 'Dépense'}) ?`)) {
            this.loading = true;
            if (payment.source === 'FACTURE') {
                this.financeService.deleteInvoice(payment.id).subscribe({
                    next: () => {
                        this.snackBar.open('Facture supprimée avec succès', 'Fermer', { duration: 3000 });
                        this.loadPayments();
                    },
                    error: (err) => {
                        console.error('Erreur suppression facture', err);
                        this.snackBar.open('Erreur lors de la suppression de la facture', 'Fermer', { duration: 3000 });
                        this.loading = false;
                    }
                });
            } else {
                this.financeService.deleteExpense(payment.id).subscribe({
                    next: () => {
                        this.snackBar.open('Dépense supprimée avec succès', 'Fermer', { duration: 3000 });
                        this.loadPayments();
                    },
                    error: (err) => {
                        console.error('Erreur suppression dépense', err);
                        this.snackBar.open('Erreur lors de la suppression de la dépense', 'Fermer', { duration: 3000 });
                        this.loading = false;
                    }
                });
            }
        }
    }

    getStatusClass(statut: string): string {
        switch (statut) {
            case 'PAYEE':
            case 'ENCAISSE':
                return 'bg-green-100 text-green-800';
            case 'PARTIELLE': return 'bg-orange-100 text-orange-800';
            case 'EN_ATTENTE':
            case 'VALIDEE':
                return 'bg-blue-100 text-blue-800';
            case 'RETARD':
            case 'REJETE':
                return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    getSourceClass(source: string): string {
        return source === 'FACTURE' ? 'bg-purple-100 text-purple-800' : 'bg-cyan-100 text-cyan-800';
    }
}
