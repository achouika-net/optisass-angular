import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SalesControlService, BrouillonInvoice, VendorStatistics } from '../services/sales-control.service';
import { RouterModule, Router } from '@angular/router';
import { Subject, switchMap, tap } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PaymentDialogComponent } from '../../client-management/dialogs/payment-dialog/payment-dialog.component';
import { PaiementService } from '../../client-management/services/paiement.service';
import { FactureService } from '../../client-management/services/facture.service';
import { StockConflictDialogComponent } from '../../client-management/dialogs/stock-conflict-dialog/stock-conflict-dialog.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProductService } from '../../stock-management/services/product.service';
import { StockStats } from '../../../shared/interfaces/product.interface';

import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../core/store/auth/auth.selectors';
import { effect } from '@angular/core';

interface MonthlyGroup {
    month: string; // MM/YYYY
    dateSort: number;
    invoices: BrouillonInvoice[];
    totalTTC: number;
    totalReste: number;
    totalPaid: number;
}

@Component({
    selector: 'app-sales-control-report',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTabsModule,
        MatCardModule,
        MatSnackBarModule,
        MatSelectModule,
        MatFormFieldModule,
        FormsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        MatDialogModule,
        MatMenuModule,
        MatDividerModule,
        MatTooltipModule
    ],
    templateUrl: './sales-control-report.component.html',
    styleUrls: ['./sales-control-report.component.scss']
})
export class SalesControlReportComponent implements OnInit {
    // Data sources
    invoicesWithPayment: BrouillonInvoice[] = [];
    invoicesWithoutPayment: BrouillonInvoice[] = [];
    invoicesValid: BrouillonInvoice[] = [];
    invoicesAvoir: BrouillonInvoice[] = [];

    // Grouped Data sources
    groupedWithPayment: MonthlyGroup[] = [];
    groupedWithoutPayment: MonthlyGroup[] = [];
    groupedValid: MonthlyGroup[] = [];
    groupedAvoir: MonthlyGroup[] = [];

    statistics: VendorStatistics[] = [];
    stockStats: any = null;

    // Filter State
    filterType: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL' = 'MONTHLY';

    // Selections
    selectedDate: Date = new Date();
    selectedMonth: number = new Date().getMonth() + 1;
    selectedYear: number = new Date().getFullYear();

    customStartDate: Date | null = null;
    customEndDate: Date | null = null;

    availableMonths = [
        { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
        { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
        { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
        { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' }
    ];
    availableYears: number[] = [];

    // Summary Metrics
    metrics = {
        totalCA: 0,
        totalFactures: 0,
        totalAvoirs: 0,
        totalBC: 0,
        totalPaid: 0,
        totalReste: 0,
        paymentBreakdown: [] as { methode: string, total: number }[]
    };

    // Filter State
    clientSearch: string = '';

    // Table columns
    columnsWithPayment = ['numero', 'client', 'dateEmission', 'totalTTC', 'montantPaye', 'resteAPayer', 'actions']; // Removed 'valide'
    columnsWithoutPayment = ['numero', 'client', 'dateEmission', 'totalTTC', 'resteAPayer', 'actions'];
    columnsValid = ['numero', 'client', 'dateEmission', 'totalTTC', 'resteAPayer', 'statut'];
    columnsAvoir = ['numero', 'client', 'dateEmission', 'totalTTC', 'resteAPayer', 'type'];
    columnsStats = ['vendorName', 'countWithPayment', 'countWithoutPayment', 'countValid', 'countAvoir', 'totalAmount'];

    loading = false;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    private refresh$ = new Subject<{ start?: string, end?: string }>();

    constructor(
        private salesControlService: SalesControlService,
        private factureService: FactureService,
        private paiementService: PaiementService,
        private snackBar: MatSnackBar,
        private router: Router,
        private dialog: MatDialog,
        private store: Store,
        private productService: ProductService,
        private cdr: ChangeDetectorRef
    ) {
        // Automatically reload when center changes
        effect(() => {
            const center = this.currentCentre();
            if (center?.id) {
                console.log(`[REPORT-SYNC] Center detected: ${center.id}, triggering load...`);
                this.loadData();
            }
        });

        // Pre-fill available years
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 5; y--) {
            this.availableYears.push(y);
        }

        // Setup the reactive data stream
        this.refresh$.pipe(
            tap(() => this.loading = true),
            switchMap((dates) => {
                console.log(`[REPORT-SYNC] Fetching data with filters:`, dates);
                return this.salesControlService.getDashboardData(undefined, dates.start, dates.end);
            })
        ).subscribe({
            next: (results) => {
                console.log('[REPORT-SYNC] Results arrived. Updating UI.');
                this.invoicesWithPayment = results.withPayments;
                this.groupedWithPayment = this.groupInvoices(results.withPayments);

                this.invoicesWithoutPayment = results.withoutPayments;
                this.groupedWithoutPayment = this.groupInvoices(results.withoutPayments);

                this.invoicesValid = results.valid;
                this.groupedValid = this.groupInvoices(results.valid);

                this.invoicesAvoir = results.avoirs;
                this.groupedAvoir = this.groupInvoices(results.avoirs);

                this.statistics = results.stats;
                this.calculateMetrics();

                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading report data:', err);
                this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    ngOnInit(): void { }

    loadData(): void {
        const dates = this.getDateRange();

        // Load stock stats
        const centerId = this.currentCentre()?.id;
        this.productService.getStockStatistics(centerId).subscribe({
            next: (stats: StockStats) => this.stockStats = stats,
            error: (err: any) => console.error('Error loading stock stats:', err)
        });

        // Trigger the refresh stream
        this.refresh$.next(dates);
    }

    private getDateRange(): { start?: string, end?: string } {
        let start: Date | undefined;
        let end: Date | undefined;

        switch (this.filterType) {
            case 'DAILY':
                start = new Date(this.selectedDate); start.setHours(0, 0, 0, 0);
                end = new Date(this.selectedDate); end.setHours(23, 59, 59, 999);
                break;
            case 'MONTHLY':
                start = new Date(this.selectedYear, this.selectedMonth - 1, 1, 0, 0, 0, 0);
                end = new Date(this.selectedYear, this.selectedMonth, 0, 23, 59, 59, 999);
                break;
            case 'YEARLY':
                start = new Date(this.selectedYear, 0, 1, 0, 0, 0, 0);
                end = new Date(this.selectedYear, 12, 0, 23, 59, 59, 999);
                break;
            case 'CUSTOM':
                if (this.customStartDate) {
                    start = new Date(this.customStartDate); start.setHours(0, 0, 0, 0);
                }
                if (this.customEndDate) {
                    end = new Date(this.customEndDate); end.setHours(23, 59, 59, 999);
                }
                break;
            case 'ALL':
            default:
                return {};
        }

        return {
            start: start?.toISOString(),
            end: end?.toISOString()
        };
    }

    groupInvoices(invoices: BrouillonInvoice[]): MonthlyGroup[] {
        const groups: { [key: string]: MonthlyGroup } = {};

        invoices.forEach(inv => {
            // [LEGACY FIX] If a DEVIS has payments, treat it visually as a BON_COMMANDE
            if (inv.type === 'DEVIS' && inv.paiements && inv.paiements.length > 0) {
                inv.type = 'BON_COMMANDE' as any;
                inv.statut = 'VENTE_EN_INSTANCE';
            }

            const date = new Date(inv.dateEmission);
            const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
            const sortKey = date.getFullYear() * 100 + (date.getMonth() + 1);

            if (!groups[monthKey]) {
                groups[monthKey] = {
                    month: monthKey,
                    dateSort: sortKey,
                    invoices: [],
                    totalTTC: 0,
                    totalReste: 0,
                    totalPaid: 0
                };
            }

            groups[monthKey].invoices.push(inv);

            if (inv.statut !== 'ANNULEE') {
                groups[monthKey].totalTTC += (inv.totalTTC || 0);
                groups[monthKey].totalReste += (inv.resteAPayer || 0);

                if (inv.paiements) {
                    const paid = inv.paiements.reduce((sum, p) => sum + p.montant, 0);
                    groups[monthKey].totalPaid += paid;
                }
            }
        });

        return Object.values(groups).sort((a, b) => b.dateSort - a.dateSort);
    }

    calculateMetrics() {
        console.log('[REPORT-DEBUG] Statistics received:', this.statistics);
        const stats = this.statistics.find(s => s.vendorId === 'all');
        if (stats) {
            this.metrics = {
                totalCA: stats.totalAmount || 0,
                totalFactures: stats.totalFactures || 0,
                totalAvoirs: stats.totalAvoirs || 0,
                totalBC: stats.totalBC || 0,
                totalPaid: stats.totalEncaissePeriod || 0,
                totalReste: stats.totalReste || 0,
                paymentBreakdown: stats.payments || []
            };
        } else {
            this.metrics = { totalCA: 0, totalFactures: 0, totalAvoirs: 0, totalBC: 0, totalPaid: 0, totalReste: 0, paymentBreakdown: [] };
        }
    }

    getPaymentLabel(methode: string): string {
        const labels: { [key: string]: string } = {
            'ESPECE': 'Espèce',
            'CHEQUE': 'Chèque',
            'VIREMENT': 'Virement',
            'CB': 'Carte Bancaire',
            'TPE': 'TPE',
            'EFFET': 'Effet',
            'OFFERT': 'Offert',
            'AUTRE': 'Autre'
        };
        return labels[methode.toUpperCase()] || methode;
    }

    setFilterType(type: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL') {
        this.filterType = type;
        this.loadData();
    }

    onFilterChange() {
        this.loadData();
    }

    getClientName(invoice: BrouillonInvoice): string {
        if (invoice.client.raisonSociale) return invoice.client.raisonSociale;
        return `${invoice.client.prenom || ''} ${invoice.client.nom || ''}`.trim();
    }

    getMontantPaye(invoice: BrouillonInvoice): number {
        if (!invoice.paiements || invoice.paiements.length === 0) return 0;
        return invoice.paiements.reduce((sum, p) => sum + p.montant, 0);
    }

    viewFiche(invoice: BrouillonInvoice): void {
        const fiche = invoice.fiche;
        const clientId = invoice.clientId;
        if (fiche && clientId) {
            const routeType = fiche.type === 'LENTILLES' ? 'fiche-lentilles' : 'fiche-monture';
            this.router.navigate(['/p/clients', clientId, routeType, fiche.id]);
        }
    }

    viewDocument(invoice: BrouillonInvoice): void {
        this.router.navigate(['/p/clients/factures', invoice.id], { queryParams: { mode: 'view' } });
    }

    validateInvoice(invoice: BrouillonInvoice): void {
        this.checkStockAndProceed(invoice, () => {
            this.loading = true;
            this.salesControlService.validateInvoice(invoice.id).subscribe({
                next: (newInvoice) => {
                    this.snackBar.open(`Commande passée : ${newInvoice.numero}`, 'Fermer', {
                        duration: 5000,
                        panelClass: ['snackbar-success']
                    });
                    this.loadData();
                },
                error: (err) => {
                    console.error('Error validating invoice:', err);
                    this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
                    this.loading = false;
                }
            });
        });
    }

    private checkStockAndProceed(invoice: BrouillonInvoice, proceedCallback: () => void) {
        this.loading = true;
        this.factureService.checkAvailability(invoice.id).subscribe({
            next: (check) => {
                this.loading = false;
                if (check.hasConflicts) {
                    const dialogRef = this.dialog.open(StockConflictDialogComponent, {
                        width: '900px',
                        data: { conflicts: check.conflicts }
                    });
                    dialogRef.afterClosed().subscribe(result => {
                        if (result && result.action === 'REPLACE') {
                            this.router.navigate(['/p/clients/factures', invoice.id]);
                        } else if (result && result.action === 'CANCEL_SALE') {
                            this.loadData();
                        }
                    });
                } else {
                    proceedCallback();
                }
            },
            error: (err) => {
                console.error('Error checking stock availability:', err);
                this.loading = false;
                this.snackBar.open('Erreur lors de la vérification du stock', 'Fermer', { duration: 5000 });
            }
        });
    }

    declareAsGift(invoice: BrouillonInvoice): void {
        if (!confirm("Etes-vous sûr de déclarer cette facture comme CADEAU ?")) return;
        this.loading = true;
        this.salesControlService.declareAsGift(invoice.id).subscribe({
            next: () => {
                this.snackBar.open('Facture déclarée comme don', 'Fermer', { duration: 3000 });
                this.loadData();
            },
            error: (err) => {
                console.error('Error declaring as gift:', err);
                this.snackBar.open('Erreur lors de la déclaration', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    archiveInvoice(invoice: BrouillonInvoice): void {
        this.salesControlService.archiveInvoice(invoice.id).subscribe({
            next: () => {
                this.snackBar.open('Devis archivé avec succès', 'Fermer', { duration: 3000 });
                this.loadData();
            },
            error: (err) => {
                console.error('Error archiving invoice:', err);
                this.snackBar.open("Erreur lors de l'archivage", 'Fermer', { duration: 3000 });
            }
        });
    }

    openPaymentDialog(invoice: BrouillonInvoice): void {
        const proceed = () => {
            const dialogRef = this.dialog.open(PaymentDialogComponent, {
                maxWidth: '95vw',
                data: { resteAPayer: invoice.resteAPayer, client: invoice.client }
            });
            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    const dto = { factureId: invoice.id, ...result, date: result.date.toISOString() };
                    this.paiementService.create(dto).subscribe({
                        next: () => {
                            this.snackBar.open('Paiement enregistré avec succès', 'OK', { duration: 3000 });
                            this.loadData();
                        },
                        error: (err) => {
                            console.error('Error saving payment:', err);
                            const msg = err.error?.message || 'Erreur lors de l\'enregistrement du paiement';
                            this.snackBar.open(msg, 'OK', { duration: 5000 });
                        }
                    });
                }
            });
        };
        if (invoice.type === 'DEVIS') this.checkStockAndProceed(invoice, proceed);
        else proceed();
    }

    createAvoir(invoice: BrouillonInvoice): void {
        import('../../client-management/dialogs/invoice-return-dialog/invoice-return-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.InvoiceReturnDialogComponent, {
                width: '800px',
                data: {
                    facture: { id: invoice.id, numero: invoice.numero, lignes: invoice.lignes || [], centreId: invoice.centreId }
                }
            });
            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.loading = true;
                    const itemsWithReason = result.items.map((it: any) => ({ ...it, reason: result.reason }));
                    this.factureService.exchangeInvoice(invoice.id, itemsWithReason).subscribe({
                        next: (res) => {
                            this.snackBar.open(`Échange effectué : Avoir ${res.avoir.numero} et Facture ${res.newFacture.numero} créés`, 'OK', { duration: 5000 });
                            this.loadData();
                            this.loading = false;
                        },
                        error: (err) => {
                            console.error('Erreur lors de l\'échange:', err);
                            this.snackBar.open('Erreur lors de l\'échange: ' + (err.error?.message || 'Erreur serveur'), 'OK', { duration: 3000 });
                            this.loading = false;
                        }
                    });
                }
            });
        });
    }
}
