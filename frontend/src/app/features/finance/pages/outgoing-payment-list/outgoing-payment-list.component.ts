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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
        MatProgressSpinnerModule,
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
    activeTab: 'OUTGOING' | 'INCOMING' | 'UNPAID_CLIENTS' = 'OUTGOING';

    get displayedColumns(): string[] {
        if (this.activeTab === 'UNPAID_CLIENTS') {
            return ['date', 'source', 'libelle', 'client', 'montant', 'reste', 'statut', 'actions'];
        }
        const base = ['date', 'source', 'libelle', 'type'];
        const middle = this.activeTab === 'OUTGOING' ? 'fournisseur' : 'client';
        return [...base, middle, 'montant', 'statut', 'actions'];
    }

    loading = false;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    // Subtotals
    subtotals = {
        totalTTC: 0,
        totalHT: 0,
        totalReste: 0,
        count: 0
    };

    suppliers: Supplier[] = [];
    types: string[] = [
        'LOYER', 'ELECTRICITE', 'EAU', 'INTERNET', 'TELEPHONE', 'SALAIRE',
        'ACHAT_MARCHANDISE', 'TRANSPORT', 'REPAS', 'AUTRE',
        'ACHAT_STOCK', 'FRAIS_GENERAUX', 'IMMOBILISATION'
    ];

    filters: any = {
        source: '',
        fournisseurId: '',
        type: '',
        startDate: new Date(),
        endDate: new Date(),
        centreId: ''
    };
    selectedPeriod: string = 'TODAY';
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
            if (center?.id && center.id !== this.filters.centreId) {
                console.log(`[PAYMENTS-SYNC] Center changed to: ${center.id}, triggering load...`);
                this.filters.centreId = center.id;
                this.loadPayments();
            }
        });
    }

    ngOnInit(): void {
        this.loadSuppliers();

        const center = this.currentCentre();
        if (center?.id) {
            this.filters.centreId = center.id;
        }

        // Initialize filters and trigger the first load
        this.applyPredefinedPeriod('TODAY', false);
        this.loadPayments();
    }

    openInvoiceDialog() {
        const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
            width: '1200px',
            maxWidth: '95vw',
            maxHeight: '90vh',
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
        const index = event.index;
        if (index === 0) this.activeTab = 'OUTGOING';
        else if (index === 1) this.activeTab = 'INCOMING';
        else this.activeTab = 'UNPAID_CLIENTS';

        this.loadPayments();
    }

    loadPayments() {
        this.loading = true;
        console.log(`[PAYMENTS-LOAD] Loading ${this.activeTab} payments with filters:`, this.filters);

        const formatDate = (d: any) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            const year = dt.getFullYear();
            const month = (dt.getMonth() + 1).toString().padStart(2, '0');
            const day = dt.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const params = {
            ...this.filters,
            startDate: formatDate(this.filters.startDate),
            endDate: formatDate(this.filters.endDate)
        };

        let request;
        if (this.activeTab === 'OUTGOING') {
            request = this.financeService.getConsolidatedOutgoings(params);
        } else if (this.activeTab === 'INCOMING') {
            request = this.financeService.getConsolidatedIncomings(params);
        } else {
            request = this.financeService.getUnpaidClientInvoices(params);
        }

        request.subscribe({
            next: (data) => {
                console.log(`[PAYMENTS-LOAD] Received ${data.length} records for ${this.activeTab}`);

                if (this.activeTab === 'UNPAID_CLIENTS') {
                    // Map raw Factures to Table Model
                    this.payments = data.map((f: any) => ({
                        id: f.id,
                        date: f.createdAt,
                        source: 'FACTURE_CLIENT',
                        libelle: `Reste Facture ${f.numero}`,
                        type: f.type,
                        client: f.client,
                        montant: f.totalTTC,
                        resteAPayer: f.resteAPayer,
                        statut: f.statut,
                        numero: f.numero
                    }));
                } else {
                    this.payments = data;
                }

                this.calculateSubtotals();
                this.loading = false;
            },
            error: (err) => {
                console.error('[PAYMENTS-LOAD] Error loading data:', err);
                this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    calculateSubtotals() {
        this.subtotals = {
            totalTTC: 0,
            totalHT: 0,
            totalReste: 0,
            count: this.payments.length
        };

        this.payments.forEach(p => {
            // Use original sign to calculate Net Total (Income - Refunds)
            const ttc = (p.totalTTC !== undefined ? p.totalTTC : p.montant) || 0;
            const ht = p.totalHT || p.montantHT || 0;
            const reste = p.resteAPayer || 0;

            this.subtotals.totalTTC += ttc;
            this.subtotals.totalHT += ht;
            this.subtotals.totalReste += reste;
        });
    }

    private filterTimeout: any;
    applyFilters(immediate: boolean = false) {
        if (this.filterTimeout) clearTimeout(this.filterTimeout);

        if (immediate) {
            this.loadPayments();
            return;
        }

        // If dates are changed manually, set period to custom
        this.selectedPeriod = 'CUSTOM';

        this.filterTimeout = setTimeout(() => {
            this.loadPayments();
        }, 300);
    }

    applyPredefinedPeriod(period: string, load: boolean = true) {
        this.selectedPeriod = period;
        const now = new Date();
        const start = new Date();
        const end = new Date();

        switch (period) {
            case 'TODAY':
                break; // Both are today
            case 'YESTERDAY':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'THIS_WEEK':
                const day = now.getDay(); // 0 is Sun
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
                start.setDate(diff);
                break;
            case 'THIS_MONTH':
                start.setDate(1);
                break;
            case 'ALL':
                this.filters.startDate = '';
                this.filters.endDate = '';
                this.loadPayments();
                return;
        }

        if (period !== 'ALL') {
            this.filters.startDate = start;
            this.filters.endDate = end;
        }
        if (load) {
            this.loadPayments();
        }
    }

    resetFilters() {
        this.filters = {
            source: '',
            fournisseurId: '',
            type: '',
            startDate: new Date(),
            endDate: new Date(),
            centreId: this.currentCentre()?.id || ''
        };
        this.selectedPeriod = 'TODAY';
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
                    width: '1200px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
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

    validatePayment(payment: any) {
        if (confirm('Voulez-vous confirmer l\'encaissement de ce paiement ?')) {
            this.financeService.validatePayment(payment.id).subscribe({
                next: () => {
                    this.snackBar.open('Paiement validé avec succès', 'Fermer', { duration: 3000 });
                    this.loadPayments();
                },
                error: (err) => {
                    console.error('Error validating payment:', err);
                    this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
                }
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

    trackByPayment(index: number, item: any): string {
        return item.id + item.source;
    }
}
