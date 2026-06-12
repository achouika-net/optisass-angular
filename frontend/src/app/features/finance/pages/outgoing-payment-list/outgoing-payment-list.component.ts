import { Component, OnInit, effect, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { SupplierInvoiceListComponent } from '../supplier-invoice-list/supplier-invoice-list.component';
import { Subject, of, Observable } from 'rxjs';
import { takeUntil, tap, switchMap, catchError, map } from 'rxjs/operators';
import { FinanceService } from '../../services/finance.service';
import { SupplierInvoice } from '../../models/finance.models';
import { Supplier } from '../../models/finance.models';
import { InvoiceFormDialogComponent } from '../../components/invoice-form-dialog/invoice-form-dialog.component';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog.component';
import { BcHistoryListComponent } from '../../components/bc-history-list/bc-history-list.component';
import { FinancePrintService } from '../../services/finance-print.service';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { CompanySettings } from '../../../../shared/interfaces/company-settings.interface';

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
        MatPaginatorModule,
        RouterModule,
        SupplierInvoiceListComponent,
        BcHistoryListComponent
    ],
    templateUrl: './outgoing-payment-list.component.html',
    styles: [`
    .container { 
      width: 100%;
      max-width: 98%; 
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
    activeTab: 'OUTGOING' | 'INCOMING' | 'UNPAID_CLIENTS' | 'FACTURES' | 'BL' | 'BC_HISTORY' = 'OUTGOING';
    viewMode: 'PAIEMENTS' | 'FACTURES' = 'PAIEMENTS';

    get filteredTabs() {
        if (this.viewMode === 'FACTURES') {
            return ['FACTURES', 'BL', 'BC_HISTORY'];
        }
        return ['OUTGOING', 'INCOMING', 'UNPAID_CLIENTS'];
    }

    get displayedColumns(): string[] {
        if (this.activeTab === 'UNPAID_CLIENTS') {
            return ['date', 'type', 'libelle', 'client', 'montant', 'reste', 'statut', 'actions'];
        }
        const base = ['date', 'type', 'libelle', 'banque'];
        const middle = this.activeTab === 'OUTGOING' ? 'fournisseur' : 'client';
        return [...base, 'methodePaiement', 'numeroPiece', 'datePiece', middle, 'montant', 'statut', 'actions'];
    }

    loading = false;
    private destroy$ = new Subject<void>();
    private loadRequestId = 0; // Cancel-token for race condition prevention
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    companySettings: CompanySettings | null = null;

    // Pagination
    totalRecords = 0;
    pageSize = 10;
    pageIndex = 0;

    // Subtotals
    subtotals = {
        totalTTC: 0,
        totalHT: 0,
        totalReste: 0,
        count: 0,
        inHand: 0,
        deposited: 0,
        paid: 0
    };

    suppliers: Supplier[] = [];
    centers: any[] = [];
    types: string[] = [
        'ACHAT_VERRE_OPTIQUE', 'ACHAT_MONTURES_OPTIQUE', 'ACHAT_MONTURES_SOLAIRE',
        'ACHAT_LENTILLES', 'ACHAT_PRODUITS', 'COTISATION_AMO_CNSS',
        'LOYER', 'ELECTRICITE', 'EAU', 'INTERNET', 'TELEPHONE', 'SALAIRE',
        'ACHAT_MARCHANDISE', 'TRANSPORT', 'REPAS', 'AVOIR', 'AUTRE'
    ];

    filters: any = {
        source: '',
        fournisseurId: '',
        type: '',
        startDate: '',
        endDate: '',
        centreId: '',
        dateType: 'ECHEANCE',
        modePaiement: '',
        statut: 'ALL'
    };
    selectedPeriod: string = 'THIS_MONTH';
    constructor(
        private financeService: FinanceService,
        private router: Router,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private store: Store,
        private route: ActivatedRoute,
        private http: HttpClient,
        private zone: NgZone,
        private cd: ChangeDetectorRef,
        private printService: FinancePrintService,
        private settingsService: CompanySettingsService
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
        this.loadCenters();
        this.loadCompanySettings();

        const center = this.store.selectSignal(UserCurrentCentreSelector)();
        if (center?.id && !this.filters.centreId) {
            this.filters.centreId = center.id;
        }

        this.applyPredefinedPeriod('THIS_MONTH', false);

        // Initial load
        this.loadPayments();

        this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
            const mode = params.get('mode');
            if (mode === 'FACTURES' || mode === 'PAIEMENTS') {
                this.viewMode = mode as any;
            }

            const tab = params.get('tab');
            if (tab && this.filteredTabs.includes(tab)) {
                this.activeTab = tab as any;
            } else if (!this.filteredTabs.includes(this.activeTab)) {
                this.activeTab = this.viewMode === 'FACTURES' ? 'FACTURES' : 'OUTGOING';
            }

            const start = params.get('startDate');
            const end = params.get('endDate');
            const dateType = params.get('dateType');
            const statut = params.get('statut');
            const modePaiement = params.get('modePaiement');

            if (dateType) this.filters.dateType = dateType;
            if (statut) this.filters.statut = statut;
            if (modePaiement) this.filters.modePaiement = modePaiement;

            if (start && end) {
                console.log(`[PAYMENTS-NAV] Applying external range: ${start} to ${end}`);
                this.filters.startDate = new Date(start);
                this.filters.endDate = new Date(end);
                this.selectedPeriod = 'CUSTOM';
            }

            this.pageIndex = 0;
            this.loadPayments();
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadCompanySettings(): void {
        this.settingsService.getSettings().subscribe(settings => {
            this.companySettings = settings;
        });
    }

    print() {
        let title = '';
        let cols: { key: string, label: string }[] = [];
        
        if (this.activeTab === 'INCOMING') {
            title = 'Journal des Recettes';
            cols = [
                { key: 'datePiece', label: 'Date' },
                { key: 'numeroPiece', label: 'Réf / Facture' },
                { key: 'client', label: 'Client / Source' },
                { key: 'methodePaiement', label: 'Mode' },
                { key: 'montant', label: 'Montant' },
                { key: 'statut', label: 'Statut' }
            ];
        } else if (this.activeTab === 'OUTGOING') {
            title = 'Journal des Dépenses';
            cols = [
                { key: 'datePiece', label: 'Date' },
                { key: 'numeroPiece', label: 'Réf / Facture' },
                { key: 'fournisseur', label: 'Fournisseur / Libellé' },
                { key: 'type', label: 'Catégorie' },
                { key: 'methodePaiement', label: 'Mode' },
                { key: 'montant', label: 'Montant' },
                { key: 'statut', label: 'Statut' }
            ];
        } else if (this.activeTab === 'UNPAID_CLIENTS') {
            title = 'Liste des Impayés Clients';
            cols = [
                { key: 'date', label: 'Date' },
                { key: 'libelle', label: 'Libellé' },
                { key: 'client', label: 'Client' },
                { key: 'montant', label: 'Total TTC' },
                { key: 'reste', label: 'Reste à Payer' },
                { key: 'statut', label: 'Statut' }
            ];
        } else {
            return;
        }

        const totals: any = {
            'Nombre de lignes': this.payments.length,
            'Total TTC': this.subtotals.totalTTC
        };
        
        if (this.activeTab === 'UNPAID_CLIENTS') {
            totals['Total Reste'] = this.subtotals.totalReste;
        }

        this.printService.printFinanceTable(title, cols, this.payments, totals, this.companySettings);
    }

    loadPayments() {
        const requestId = ++this.loadRequestId; // Each call gets a unique ID
        this.loading = true;
        console.log(`[RESTORE-UI] Loading ${this.activeTab} data... (request #${requestId})`);

        const formatDate = (d: any) => {
            if (!d) return '';
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return '';
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const params: any = {
            ...this.filters,
            startDate: formatDate(this.filters.startDate),
            endDate: formatDate(this.filters.endDate),
            page: this.pageIndex + 1,
            limit: this.pageSize,
            _t: Date.now()
        };

        // Map modePaiement to mode for backend
        if (this.filters.modePaiement) {
            params.mode = this.filters.modePaiement;
        }

        let request$: Observable<any>;
        if (this.activeTab === 'OUTGOING') {
            request$ = this.financeService.getConsolidatedOutgoings(params);
        } else if (this.activeTab === 'INCOMING') {
            request$ = this.financeService.getConsolidatedIncomings(params);
        } else if (this.activeTab === 'UNPAID_CLIENTS') {
            request$ = this.financeService.getConsolidatedUnpaid(params);
        } else {
            request$ = of({ data: [], total: 0, subtotals: { totalTTC: 0, totalReste: 0 } });
        }

        request$.pipe(
            takeUntil(this.destroy$),
            catchError((err: any) => {
                this.zone.run(() => {
                    this.handleError(err);
                });
                return of(null);
            })
        ).subscribe({
            next: (res: any) => {
                this.zone.run(() => {
                    // Ignore stale responses from older requests
                    if (requestId !== this.loadRequestId) {
                        console.log(`[RESTORE-UI] Ignoring stale response for request #${requestId}`);
                        return;
                    }
                    if (res) {
                        this.processResults(res);
                    }
                    this.loading = false;
                    this.cd.detectChanges();
                });
            },
            error: (err: any) => {
                this.zone.run(() => {
                    if (requestId !== this.loadRequestId) return;
                    console.error(`[RESTORE-UI] CRITICAL ERROR:`, err);
                    this.loading = false;
                    this.cd.detectChanges();
                });
            }
        });
    }

    private handleError(err: any) {
        console.error('[PAYMENTS-LOAD] Error:', err);
        this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
        this.loading = false;
    }

    private processResults(res: any) {
        console.log(`[PAYMENTS-PROC] Processing ${res.data?.length || 0} rows...`);
        this.payments = res.data || [];
        this.totalRecords = res.total || 0;

        // Use global subtotals from backend
        this.subtotals.count = res.total || 0;

        this.subtotals.totalTTC = res.subtotals?.totalTTC || 0;
        this.subtotals.totalHT = res.subtotals?.totalHT || 0;
        this.subtotals.totalReste = res.subtotals?.totalReste || 0;
        
        // Portfolio metrics
        this.subtotals.inHand = res.subtotals?.inHand || 0;
        this.subtotals.deposited = res.subtotals?.deposited || 0;
        this.subtotals.paid = res.subtotals?.paid || 0;

        // Note: calculatePageSubtotals is no longer called here to avoid overwriting global totals
        console.log(`[PAYMENTS-PROC] Subtotals mapped:`, this.subtotals);
        console.log(`[PAYMENTS-PROC] Finished processing.`);
    }

    onSubComponentStatsUpdated(stats: any) {
        if (['FACTURES', 'BL'].includes(this.activeTab)) {
            this.subtotals = {
                ...this.subtotals,
                count: stats.count || 0,
                totalTTC: stats.totalTTC || 0,
                totalHT: stats.totalHT || 0,
                totalReste: stats.totalReste || 0
            };
        }
    }



    loadSuppliers() {
        this.financeService.getSuppliers().subscribe(data => this.suppliers = data);
    }

    loadCenters() {
        // We can get centers from the store or a service. 
        // For now, let's inject AuthService or use the store if available.
        // Actually, let's just add it to financeService if not there.
        this.http.get<any[]>(`${this.financeService['apiUrl']}/centers`).subscribe(data => this.centers = data);
    }

    onTabChange(event: any) {
        const index = event.index;
        const tabsInMode = this.filteredTabs;
        
        if (tabsInMode[index]) {
            this.activeTab = tabsInMode[index] as any;
        }

        if (['OUTGOING', 'INCOMING', 'UNPAID_CLIENTS'].includes(this.activeTab)) {
            this.pageIndex = 0;
            this.loadPayments();
        }
    }

    onPageChange(event: PageEvent) {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadPayments();
    }

    calculatePageSubtotals() {
        // This only calculates for the visible page
        // For Total TTC we use the globally provided backend total
        this.subtotals.totalHT = 0;
        this.subtotals.totalReste = 0;

        this.payments.forEach(p => {
            const ht = p.totalHT || p.montantHT || 0;
            const reste = p.resteAPayer || 0;
            this.subtotals.totalHT += ht;
            this.subtotals.totalReste += reste;
        });
    }

    calculateSubtotals(fullSet: boolean = false) {
        if (fullSet) {
            this.subtotals.totalTTC = 0;
            this.subtotals.totalHT = 0;
            this.subtotals.totalReste = 0;
            this.payments.forEach(p => {
                const ttc = (p.totalTTC !== undefined ? p.totalTTC : p.montant) || 0;
                const ht = p.totalHT || p.montantHT || 0;
                const reste = p.resteAPayer || 0;
                this.subtotals.totalTTC += ttc;
                this.subtotals.totalHT += ht;
                this.subtotals.totalReste += reste;
            });
        } else {
            this.calculatePageSubtotals();
        }
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
            case 'LAST_WEEK':
                const lwd = now.getDay();
                const lwDiff = now.getDate() - lwd + (lwd === 0 ? -6 : 1) - 7;
                start.setDate(lwDiff);
                end.setDate(start.getDate() + 6);
                break;
            case 'THIS_MONTH':
                start.setDate(1);
                break;
            case 'LAST_MONTH':
                start.setMonth(now.getMonth() - 1, 1);
                end.setMonth(now.getMonth(), 0); // Last day of prev month
                break;
            case 'LAST_3_MONTHS':
                start.setMonth(now.getMonth() - 3, 1);
                break;
            case 'LAST_6_MONTHS':
                start.setMonth(now.getMonth() - 6, 1);
                break;
            case 'THIS_QUARTER':
                const q = Math.floor(now.getMonth() / 3);
                start.setMonth(q * 3, 1);
                break;
            case 'LAST_QUARTER':
                const lq = Math.floor(now.getMonth() / 3) - 1;
                start.setMonth(lq * 3, 1);
                end.setMonth(lq * 3 + 3, 0);
                break;
            case 'THIS_YEAR':
                start.setMonth(0, 1);
                break;
            case 'LAST_YEAR':
                start.setFullYear(now.getFullYear() - 1, 0, 1);
                end.setFullYear(now.getFullYear() - 1, 11, 31);
                break;
            case 'ALL':
                this.filters.startDate = '';
                this.filters.endDate = '';
                this.pageIndex = 0;
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
        this.selectedPeriod = 'ALL';
        this.loadPayments();
    }

    openInvoiceDialog(invoice?: SupplierInvoice, viewMode: boolean = false) {
        const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
            width: '1100px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            data: { invoice, viewMode, isBL: false }
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

    viewDetail(payment: any, viewMode: boolean = false) {
        if (payment.source === 'FACTURE_CLIENT') {
            // Navigate to Client Invoice page
            this.router.navigate(['/p/clients/factures', payment.id], { queryParams: { mode: 'view' } });
            return;
        }

        if (payment.source === 'FACTURE') {
            this.financeService.getInvoice(payment.id).subscribe(invoice => {
                const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
                    width: '1100px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    data: {
                        invoice: {
                            ...invoice,
                            viewMode
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
                    width: '750px',
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
            if (this.activeTab === 'INCOMING') {
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
            } else {
                // Outgoing payments (Factures/Depenses) use EcheancePaiement
                const id = payment.echeanceId || payment.id;
                this.financeService.validateEcheance(id).subscribe({
                    next: () => {
                        this.snackBar.open('Paiement validé avec succès', 'Fermer', { duration: 3000 });
                        this.loadPayments();
                    },
                    error: (err) => {
                        console.error('Error validating echeance:', err);
                        this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
                    }
                });
            }
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
        const s = (source || '').toUpperCase();
        if (s.includes('FACTURE')) return 'bg-purple-100 text-purple-800';
        if (s.includes('DEPENSE')) return 'bg-cyan-100 text-cyan-800';
        return 'bg-gray-100 text-gray-800';
    }

    trackByPayment(index: number, item: any): string {
        return (item.echeanceId || item.id || '') + (item.source || '') + index;
    }

    updateStatus(item: any, newStatut: string) {
        // For outgoings, we must use the echeanceId if it exists, otherwise fallback to id
        const idToUse = item.echeanceId || item.id;

        const request = item.source === 'FACTURE_CLIENT'
            ? this.financeService.validatePayment(item.id, newStatut)
            : this.financeService.validateEcheance(idToUse, newStatut);

        request.subscribe({
            next: () => {
                this.snackBar.open('Opération validée', 'OK', { duration: 2000 });
                this.loadPayments();
            },
            error: (err) => {
                console.error('Validation error:', err);
                this.snackBar.open('Erreur lors de la validation', 'OK');
            }
        });
    }
}
