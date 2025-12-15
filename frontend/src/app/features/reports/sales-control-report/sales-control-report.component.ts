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
        FormsModule
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

    // Filter State
    selectedPeriod: string = 'ALL';
    availablePeriods: string[] = [];

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

        [...this.groupedWithPayment, ...this.groupedWithoutPayment, ...this.groupedValid, ...this.groupedAvoir]
            .forEach(g => periods.add(g.month));

        // Convert to array and sort (descending by year/month)
        this.availablePeriods = Array.from(periods).sort((a, b) => {
            const [m1, y1] = a.split('/').map(Number);
            const [m2, y2] = b.split('/').map(Number);
            return (y2 * 100 + m2) - (y1 * 100 + m1);
        });
    }

    calculateMetrics() {
        this.metrics = {
            totalCA: 0,
            totalPaid: 0,
            totalReste: 0
        };

        const sumGroups = (groups: MonthlyGroup[]) => {
            groups.forEach(g => {
                if (this.selectedPeriod === 'ALL' || g.month === this.selectedPeriod) {
                    this.metrics.totalCA += g.totalTTC;
                    this.metrics.totalPaid += g.totalPaid;
                    this.metrics.totalReste += g.totalReste;
                }
            });
        };

        sumGroups(this.groupedWithPayment);
        sumGroups(this.groupedWithoutPayment);
        sumGroups(this.groupedValid);
    }

    onPeriodChange() {
        this.calculateMetrics();
    }

    isGroupVisible(group: MonthlyGroup): boolean {
        return this.selectedPeriod === 'ALL' || group.month === this.selectedPeriod;
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
        if (confirm(`Valider la facture ${invoice.numero}?\n\nCela créera automatiquement un AVOIR pour la traçabilité fiscale.`)) {
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
    }

    declareAsGift(invoice: BrouillonInvoice): void {
        if (confirm(`Déclarer la facture ${invoice.numero} comme don/offert?\n\nLe montant sera mis à 0 DH.`)) {
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
    }
}
