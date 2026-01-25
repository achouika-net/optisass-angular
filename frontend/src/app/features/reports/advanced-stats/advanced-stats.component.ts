import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { StatsService, StatsSummary } from '../services/stats.service';
import { forkJoin } from 'rxjs';

Chart.register(...registerables);

@Component({
    selector: 'app-advanced-stats',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatFormFieldModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        FormsModule
    ],
    templateUrl: './advanced-stats.component.html',
    styleUrls: ['./advanced-stats.component.scss']
})
export class AdvancedStatsComponent implements OnInit, AfterViewInit {
    loading = false;
    summary: StatsSummary | null = null;

    // Filter controls
    selectedPeriod: 'daily' | 'monthly' | 'yearly' = 'monthly';
    startDate: Date | null = null;
    endDate: Date | null = null;

    // Charts
    private revenueChart: Chart | null = null;
    private productChart: Chart | null = null;
    private conversionChart: Chart | null = null;
    private stockChart: Chart | null = null;
    private clientsChart: Chart | null = null;
    private paymentsChart: Chart | null = null;

    constructor(private statsService: StatsService) { }

    ngOnInit(): void {
        // Set default date range (last 12 months)
        this.endDate = new Date();
        this.startDate = new Date();
        this.startDate.setMonth(this.startDate.getMonth() - 12);
    }

    ngAfterViewInit(): void {
        // Delay to ensure DOM is fully rendered
        setTimeout(() => {
            this.loadData();
        }, 100);
    }

    loadData(): void {
        this.loading = true;
        const start = this.startDate?.toISOString();
        const end = this.endDate?.toISOString();

        console.log('📊 [Stats] Loading data with filters:', { period: this.selectedPeriod, start, end });

        forkJoin({
            summary: this.statsService.getSummary(),
            revenue: this.statsService.getRevenueEvolution(this.selectedPeriod, start, end),
            products: this.statsService.getProductDistribution(),
            conversion: this.statsService.getConversionRate(start, end),
            stock: this.statsService.getStockByWarehouse(),
            clients: this.statsService.getTopClients(10, start, end),
            payments: this.statsService.getPaymentMethods(start, end)
        }).subscribe({
            next: (data) => {
                console.log('✅ [Stats] Data loaded successfully:', data);
                this.summary = data.summary;
                this.createRevenueChart(data.revenue);

                // Normalisation des types de produits (Monture, monture, MONTURE_OPTIQUE -> Monture)
                const normalizedProducts = this.normalizeProductData(data.products);
                this.createProductChart(normalizedProducts);

                this.createConversionChart(data.conversion);
                this.createStockChart(data.stock);
                this.createClientsChart(data.clients);
                this.createPaymentsChart(data.payments);
                this.loading = false;
            },
            error: (err) => {
                console.error('❌ [Stats] Error loading stats:', err);
                alert('Erreur lors du chargement des statistiques: ' + (err.error?.message || err.message));
                this.loading = false;
            }
        });
    }

    private normalizeProductData(data: any[]): any[] {
        if (!data) return [];

        const aggregated: { [key: string]: number } = {};

        data.forEach(item => {
            let type = item.type;

            // Normalisation spécifique demandée
            if (['monture', 'Monture', 'MONTURE_OPTIQUE'].includes(type)) {
                type = 'Monture';
            }
            // On garde les autres types tels quels (ex: MONTURE_SOLAIRE, ACCESSOIRE)

            if (!aggregated[type]) {
                aggregated[type] = 0;
            }
            aggregated[type] += item.value;
        });

        return Object.keys(aggregated).map(key => ({
            type: key,
            value: aggregated[key]
        }));
    }

    private createRevenueChart(data: any[]): void {
        const ctx = document.getElementById('revenueChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.revenueChart) {
            this.revenueChart.destroy();
        }

        if (!data || data.length === 0) {
            console.warn('⚠️ [Stats] No revenue data available');
            return;
        }

        console.log('📊 [Stats] Creating revenue chart with', data.length, 'data points');

        this.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.period),
                datasets: [{
                    label: 'Chiffre d\'Affaires (DH)',
                    data: data.map(d => d.revenue),
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                    title: { display: false }
                }
            }
        });
    }

    private createProductChart(data: any[]): void {
        const ctx = document.getElementById('productChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.productChart) {
            this.productChart.destroy();
        }

        if (!data || data.length === 0) {
            console.warn('⚠️ [Stats] No product distribution data available');
            return;
        }

        console.log('📊 [Stats] Creating product chart with', data.length, 'categories');

        this.productChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.type),
                datasets: [{
                    data: data.map(d => d.value),
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#9966FF',
                        '#FF9F40'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }

    private createConversionChart(data: any): void {
        const ctx = document.getElementById('conversionChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.conversionChart) {
            this.conversionChart.destroy();
        }

        this.conversionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Devis', 'Factures Validées', 'Factures Payées'],
                datasets: [{
                    label: 'Nombre',
                    data: [data.totalDevis, data.validatedFactures, data.paidFactures],
                    backgroundColor: ['#FFC107', '#2196F3', '#4CAF50']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    private createStockChart(data: any[]): void {
        const ctx = document.getElementById('stockChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.stockChart) {
            this.stockChart.destroy();
        }

        this.stockChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.warehouseName),
                datasets: [{
                    label: 'Valeur Stock (DH)',
                    data: data.map(d => d.totalValue),
                    backgroundColor: '#9C27B0'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    private createClientsChart(data: any[]): void {
        const ctx = document.getElementById('clientsChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.clientsChart) {
            this.clientsChart.destroy();
        }

        this.clientsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.clientName),
                datasets: [{
                    label: 'CA Total (DH)',
                    data: data.map(d => d.totalRevenue),
                    backgroundColor: '#FF5722'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    private createPaymentsChart(data: any[]): void {
        const ctx = document.getElementById('paymentsChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.paymentsChart) {
            this.paymentsChart.destroy();
        }

        this.paymentsChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(d => d.method),
                datasets: [{
                    data: data.map(d => d.totalAmount),
                    backgroundColor: [
                        '#4CAF50',
                        '#2196F3',
                        '#FF9800',
                        '#E91E63',
                        '#9C27B0'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    onPeriodChange(): void {
        this.loadData();
    }

    onDateRangeChange(): void {
        if (this.startDate && this.endDate) {
            this.loadData();
        }
    }

    ngOnDestroy(): void {
        // Cleanup charts
        [this.revenueChart, this.productChart, this.conversionChart,
        this.stockChart, this.clientsChart, this.paymentsChart].forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}
