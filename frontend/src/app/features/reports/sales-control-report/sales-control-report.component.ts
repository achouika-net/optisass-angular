import { Component, OnInit } from '@angular/core';
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
import { forkJoin, Subject, switchMap, tap } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PaymentDialogComponent } from '../../client-management/factures/payment-dialog/payment-dialog.component';
import { PaiementService } from '../../client-management/services/paiement.service';
import { FactureService } from '../../client-management/services/facture.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

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
    groupedArchived: MonthlyGroup[] = [];

    statistics: VendorStatistics[] = [];

    // Filter State
    filterType: 'DAILY' | 'MONTHLY' | 'SEMESTER' | 'YEARLY' | 'CUSTOM' | 'ALL' = 'MONTHLY';

    // Selections
    selectedDate: Date = new Date();
    selectedMonth: string = ''; // 'MM/YYYY'
    selectedYear: number = new Date().getFullYear();
    selectedSemester: number = 1;
    customStartDate: Date | null = null;
    customEndDate: Date | null = null;

    availablePeriods: string[] = [];
    availableYears: number[] = [];

    // Summary Metrics
    metrics = {
        totalCA: 0,
        totalPaid: 0,
        totalReste: 0
    };

    // Table columns
    columnsWithPayment = ['numero', 'client', 'dateEmission', 'totalTTC', 'montantPaye', 'resteAPayer', 'actions'];
    columnsWithoutPayment = ['numero', 'client', 'dateEmission', 'totalTTC', 'resteAPayer', 'actions'];
    columnsValid = ['numero', 'client', 'dateEmission', 'totalTTC', 'resteAPayer', 'statut'];
    columnsAvoir = ['numero', 'client', 'dateEmission', 'totalTTC', 'resteAPayer', 'type'];
    columnsStats = ['vendorName', 'countWithPayment', 'countWithoutPayment', 'countValid', 'countAvoir', 'totalAmount'];

    loading = false;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    private refresh$ = new Subject<void>();

    constructor(
        private salesControlService: SalesControlService,
        private factureService: FactureService,
        private paiementService: PaiementService,
        private snackBar: MatSnackBar,
        private router: Router,
        private dialog: MatDialog,
        private store: Store
    ) {
        // Automatically reload when center changes
        effect(() => {
            const center = this.currentCentre();
            if (center?.id) {
                console.log(`[REPORT-SYNC] Center detected: ${center.id}, triggering load...`);
                this.loadData();
            }
        });

        // Setup the reactive data stream
        this.refresh$.pipe(
            tap(() => this.loading = true),
            switchMap(() => {
                const centerId = this.currentCentre()?.id;
                console.log(`[REPORT-SYNC] SwitchMap fetching for: ${centerId || 'none'}`);
                return this.salesControlService.getDashboardData();
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

                this.groupedArchived = this.groupInvoices(results.archived);

                this.statistics = results.stats;

                this.updateAvailablePeriods();
                this.calculateMetrics();
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading report data:', err);
                this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
                this.loading = false;
            }
        });
    }

    ngOnInit(): void {
        // Handled by effect on center change
    }

    loadData(): void {
        // Clear existing data to prevent flicker/stale data from previous center
        this.invoicesWithPayment = [];
        this.invoicesWithoutPayment = [];
        this.invoicesValid = [];
        this.invoicesAvoir = [];
        this.groupedWithPayment = [];
        this.groupedWithoutPayment = [];
        this.groupedValid = [];
        this.groupedAvoir = [];
        this.groupedArchived = [];
        this.statistics = [];

        // Trigger the refresh stream
        this.refresh$.next();
    }

    groupInvoices(invoices: BrouillonInvoice[]): MonthlyGroup[] {
        const groups: { [key: string]: MonthlyGroup } = {};

        invoices.forEach(inv => {
            const date = new Date(inv.dateEmission);
            const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`; // e.g. "12/2025"
            const sortKey = date.getFullYear() * 100 + (date.getMonth() + 1); // e.g. 202512

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
            groups[monthKey].totalTTC += (inv.totalTTC || 0);
            groups[monthKey].totalReste += (inv.resteAPayer || 0);

            if (inv.paiements) {
                const paid = inv.paiements.reduce((sum, p) => sum + p.montant, 0);
                groups[monthKey].totalPaid += paid;
            }
        });

        return Object.values(groups).sort((a, b) => b.dateSort - a.dateSort);
    }

    updateAvailablePeriods() {
        const periods = new Set<string>();
        const years = new Set<number>();

        [...this.groupedWithPayment, ...this.groupedWithoutPayment, ...this.groupedValid, ...this.groupedAvoir, ...this.groupedArchived]
            .forEach(g => {
                periods.add(g.month);
                const [m, y] = g.month.split('/').map(Number);
                years.add(y);
            });

        // Periods
        this.availablePeriods = Array.from(periods).sort((a, b) => {
            const [m1, y1] = a.split('/').map(Number);
            const [m2, y2] = b.split('/').map(Number);
            return (y2 * 100 + m2) - (y1 * 100 + m1);
        });

        // Years
        this.availableYears = Array.from(years).sort((a, b) => b - a);

        // Set default month/year if available or if current selection is invalid for this center
        if (this.availablePeriods.length > 0) {
            if (!this.selectedMonth || !this.availablePeriods.includes(this.selectedMonth)) {
                this.selectedMonth = this.availablePeriods[0];
            }
        } else {
            this.selectedMonth = '';
        }

        if (this.availableYears.length > 0) {
            if (!this.selectedYear || !this.availableYears.includes(this.selectedYear)) {
                this.selectedYear = this.availableYears[0];
            }
        }
    }

    calculateMetrics() {
        this.metrics = {
            totalCA: 0,
            totalPaid: 0,
            totalReste: 0
        };

        const sumInvoices = (groups: MonthlyGroup[]) => {
            groups.forEach(g => {
                g.invoices.forEach(inv => {
                    if (this.isInvoiceVisible(inv)) {
                        this.metrics.totalCA += (inv.totalTTC || 0);
                        const paid = inv.paiements ? inv.paiements.reduce((sum, p) => sum + p.montant, 0) : 0;
                        this.metrics.totalPaid += paid;
                        this.metrics.totalReste += (inv.resteAPayer || 0);
                    }
                });
            });
        };

        // sumInvoices(this.groupedWithPayment); // Excluded as per user request: cards show validated sales ONLY
        // sumInvoices(this.groupedWithoutPayment);
        sumInvoices(this.groupedValid);
        // sumInvoices(this.groupedArchived);
    }

    onFilterChange() {
        this.calculateMetrics();
    }

    isInvoiceVisible(invoice: BrouillonInvoice): boolean {
        const date = new Date(invoice.dateEmission);

        switch (this.filterType) {
            case 'ALL':
                return true;
            case 'DAILY':
                return date.toDateString() === this.selectedDate.toDateString();
            case 'MONTHLY':
                if (!this.selectedMonth) return true;
                const [m, y] = this.selectedMonth.split('/').map(Number);
                return date.getMonth() + 1 === m && date.getFullYear() === y;
            case 'YEARLY':
                return date.getFullYear() === this.selectedYear;
            case 'SEMESTER':
                const month = date.getMonth() + 1;
                if (date.getFullYear() !== this.selectedYear) return false;
                if (this.selectedSemester === 1) return month >= 1 && month <= 6;
                else return month >= 7 && month <= 12;
            case 'CUSTOM':
                if (!this.customStartDate || !this.customEndDate) return true;
                const start = new Date(this.customStartDate); start.setHours(0, 0, 0, 0);
                const end = new Date(this.customEndDate); end.setHours(23, 59, 59, 999);
                return date >= start && date <= end;
            default:
                return true;
        }
    }

    isGroupVisible(group: MonthlyGroup): boolean {
        return group.invoices.some(inv => this.isInvoiceVisible(inv));
    }

    getClientName(invoice: BrouillonInvoice): string {
        if (invoice.client.raisonSociale) {
            return invoice.client.raisonSociale;
        }
        return `${invoice.client.prenom || ''} ${invoice.client.nom || ''}`.trim();
    }

    getMontantPaye(invoice: BrouillonInvoice): number {
        if (!invoice.paiements || invoice.paiements.length === 0) {
            return 0;
        }
        return invoice.paiements.reduce((sum, p) => sum + p.montant, 0);
    }

    getLinkedAvoirNumber(invoice: BrouillonInvoice): string {
        if (!invoice.children || invoice.children.length === 0) return '-';
        const avoir = invoice.children.find(c => c.type === 'AVOIR');
        return avoir ? avoir.numero : '-';
    }

    getParentFactureNumber(invoice: BrouillonInvoice): string {
        return invoice.parentFacture ? invoice.parentFacture.numero : '-';
    }

    validateInvoice(invoice: BrouillonInvoice): void {
        this.salesControlService.validateInvoice(invoice.id).subscribe({
            next: () => {
                this.snackBar.open('Facture validée avec succès', 'Fermer', { duration: 3000 });
                this.loadData(); // Reload data
            },
            error: (err) => {
                console.error('Error validating invoice:', err);
                this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
            }
        });
    }

    declareAsGift(invoice: BrouillonInvoice): void {
        this.salesControlService.declareAsGift(invoice.id).subscribe({
            next: () => {
                this.snackBar.open('Facture déclarée comme don', 'Fermer', { duration: 3000 });
                this.loadData(); // Reload data
            },
            error: (err) => {
                console.error('Error declaring as gift:', err);
                this.snackBar.open('Erreur lors de la déclaration', 'Fermer', { duration: 3000 });
            }
        });
    }

    canArchive(invoice: BrouillonInvoice): boolean {
        // 1. Must have at least one payment
        if (this.getMontantPaye(invoice) <= 0) {
            return false;
        }

        // 2. TEMPORARY: Allow archiving if paid, regardless of stock source
        // (User Request: "point on payment explicitly for now")
        return true;
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
        const dialogRef = this.dialog.open(PaymentDialogComponent, {
            maxWidth: '95vw',
            data: {
                resteAPayer: invoice.resteAPayer,
                client: invoice.client
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const dto = {
                    factureId: invoice.id,
                    ...result,
                    date: result.date.toISOString()
                };

                this.paiementService.create(dto).subscribe({
                    next: () => {
                        this.snackBar.open('Paiement enregistré avec succès', 'OK', { duration: 3000 });
                        this.loadData();
                    },
                    error: (err) => {
                        console.error('Error saving payment:', err);
                        this.snackBar.open('Erreur lors de l\'enregistrement du paiement', 'OK', { duration: 3000 });
                    }
                });
            }
        });
    }

    viewFiche(invoice: BrouillonInvoice): void {
        const fiche = invoice.fiche;
        const clientId = invoice.clientId;

        if (fiche && clientId) {
            const routeType = fiche.type === 'LENTILLES' ? 'fiche-lentilles' : 'fiche-monture';
            this.router.navigate(['/p/clients', clientId, routeType, fiche.id]);
        } else {
            this.snackBar.open('Aucune fiche associée à cette vente', 'OK', { duration: 3000 });
        }
    }

    createAvoir(invoice: BrouillonInvoice): void {
        import('../../client-management/factures/invoice-return-dialog/invoice-return-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.InvoiceReturnDialogComponent, {
                width: '800px',
                data: {
                    facture: {
                        id: invoice.id,
                        numero: invoice.numero,
                        lignes: invoice.lignes || []
                    }
                }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.loading = true;
                    const itemsWithReason = result.items.map((it: any) => ({
                        ...it,
                        reason: result.reason
                    }));

                    this.factureService.exchangeInvoice(invoice.id, itemsWithReason).subscribe({
                        next: (res) => {
                            this.snackBar.open(`Échange effectué : Avoir ${res.avoir.numero} et Facture ${res.newFacture.numero} créés`, 'OK', {
                                duration: 5000
                            });
                            this.loadData();
                            this.loading = false;
                        },
                        error: (err) => {
                            console.error('Erreur lors de l\'échange:', err);
                            this.snackBar.open('Erreur lors de l\'échange: ' + (err.error?.message || 'Erreur serveur'), 'OK', {
                                duration: 3000
                            });
                            this.loading = false;
                        }
                    });
                }
            });
        });
    }
}
