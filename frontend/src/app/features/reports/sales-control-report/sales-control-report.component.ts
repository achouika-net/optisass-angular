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
import { RouterModule } from '@angular/router';

import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';

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
        MatInputModule
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

    constructor(
        private salesControlService: SalesControlService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading = true;

        // Load invoices with payments
        this.salesControlService.getBrouillonWithPayments().subscribe({
            next: (data) => {
                this.invoicesWithPayment = data;
                this.groupedWithPayment = this.groupInvoices(data);
                this.updateAvailablePeriods();
                this.calculateMetrics();
            },
            error: (err) => {
                console.error('Error loading invoices with payment:', err);
                this.snackBar.open('Erreur lors du chargement', 'Fermer', { duration: 3000 });
            }
        });

        // Load invoices without payments
        this.salesControlService.getBrouillonWithoutPayments().subscribe({
            next: (data) => {
                this.invoicesWithoutPayment = data;
                this.groupedWithoutPayment = this.groupInvoices(data);
                this.updateAvailablePeriods();
                this.calculateMetrics();
            },
            error: (err) => {
                console.error('Error loading invoices without payment:', err);
            }
        });

        // Load valid invoices
        this.salesControlService.getValidInvoices().subscribe({
            next: (data) => {
                this.invoicesValid = data;
                this.groupedValid = this.groupInvoices(data);
                this.updateAvailablePeriods();
                this.calculateMetrics();
            },
            error: (err) => console.error('Error loading valid invoices:', err)
        });

        // Load avoirs
        this.salesControlService.getAvoirs().subscribe({
            next: (data) => {
                this.invoicesAvoir = data;
                this.groupedAvoir = this.groupInvoices(data);
                this.updateAvailablePeriods();
                this.calculateMetrics();
            },
            error: (err) => console.error('Error loading avoirs:', err)
        });

        // Load archived (hidden from list but used for calculation)
        this.salesControlService.getArchivedInvoices().subscribe({
            next: (data) => {
                this.groupedArchived = this.groupInvoices(data);
                this.updateAvailablePeriods();
                this.calculateMetrics();
            },
            error: (err) => console.error('Error loading archived:', err)
        });

        // Load statistics
        this.salesControlService.getStatistics().subscribe({
            next: (data) => {
                this.statistics = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading statistics:', err);
                this.loading = false;
            }
        });
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
            groups[monthKey].totalTTC += inv.totalTTC;
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

        // Set default month/year if available
        if (this.availablePeriods.length > 0 && !this.selectedMonth) {
            this.selectedMonth = this.availablePeriods[0];
        }
        if (this.availableYears.length > 0) {
            this.selectedYear = this.availableYears[0];
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
                        this.metrics.totalCA += inv.totalTTC;
                        const paid = inv.paiements ? inv.paiements.reduce((sum, p) => sum + p.montant, 0) : 0;
                        this.metrics.totalPaid += paid;
                        this.metrics.totalReste += (inv.resteAPayer || 0);
                    }
                });
            });
        };

        sumInvoices(this.groupedWithPayment);
        // Exclude unpaid devis from Global Revenue as per user request
        // sumInvoices(this.groupedWithoutPayment);
        sumInvoices(this.groupedValid);
        // sumInvoices(this.groupedArchived); // Excluded from Global Revenue as per user request (Step 4554)
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
}
