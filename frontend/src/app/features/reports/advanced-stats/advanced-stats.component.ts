import { Component, OnInit, AfterViewInit, ChangeDetectorRef, NgZone, OnDestroy, ViewChild, ElementRef, effect } from '@angular/core';
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
import { StatsService, StatsSummary, WarehouseStock } from '../services/stats.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../core/store/auth/auth.selectors';
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
export class AdvancedStatsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('revenueChartCanvas') revenueChartCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('productChartCanvas') productChartCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('conversionChartCanvas') conversionChartCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('stockChartCanvas') stockChartCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('clientsChartCanvas') clientsChartCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('paymentsChartCanvas') paymentsChartCanvas!: ElementRef<HTMLCanvasElement>;

    loading = false;
    summary: StatsSummary | null = null;

    // Filter properties
    filterType: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL' = 'MONTHLY';
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

    // Charts
    private revenueChart: Chart | null = null;
    private productChart: Chart | null = null;
    private conversionChart: Chart | null = null;
    private stockChart: Chart | null = null;
    private clientsChart: Chart | null = null;
    private paymentsChart: Chart | null = null;

    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    constructor(
        private statsService: StatsService,
        private store: Store,
        private cdr: ChangeDetectorRef,
        private zone: NgZone
    ) {
        effect(() => {
            const centre = this.currentCentre() as any;
            if (centre?.id) {
                setTimeout(() => this.loadData());
            }
        });
    }

    ngOnInit(): void {
        this.initFilterOptions();
        this.loadData();
    }

    private initFilterOptions(): void {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            this.availableYears.push(currentYear - i);
        }
    }

    ngAfterViewInit(): void {
        // Data load will be triggered by filter component
    }

    setFilterType(type: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL'): void {
        this.filterType = type;
        this.loadData();
    }

    onFilterChange(): void {
        this.loadData();
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

    loadData(): void {
        this.loading = true;
        this.cdr.detectChanges();

        const dates = this.getDateRange();
        const start = dates.start;
        const end = dates.end;

        // Map filterType to selectedPeriod for getRevenueEvolution
        let currentPeriod: 'daily' | 'monthly' | 'yearly';
        switch (this.filterType) {
            case 'DAILY': currentPeriod = 'daily'; break;
            case 'MONTHLY': currentPeriod = 'daily'; break; // Show days in month
            case 'YEARLY': currentPeriod = 'monthly'; break; // Show months in year
            case 'ALL': currentPeriod = 'monthly'; break; // Fallback
            case 'CUSTOM':
                if (start && end) {
                    const diffDays = Math.ceil(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) currentPeriod = 'daily';
                    else if (diffDays <= 60) currentPeriod = 'monthly';
                    else currentPeriod = 'yearly';
                } else {
                    currentPeriod = 'monthly';
                }
                break;
            default: currentPeriod = 'monthly';
        }

        console.log('📊 [Stats] Loading data with filters:', { period: currentPeriod, start, end });
        console.time('📊 [Stats] Backend Data Fetch');

        const centreId = (this.currentCentre() as any)?.id;

        forkJoin({
            summary: this.statsService.getSummary(start, end, centreId).pipe(catchError(() => of(null))),
            revenue: this.statsService.getRevenueEvolution(currentPeriod, start, end, centreId).pipe(catchError(() => of([]))),
            products: this.statsService.getProductDistribution(start, end, centreId).pipe(catchError(() => of([]))),
            conversion: this.statsService.getConversionRate(start, end, centreId).pipe(catchError(() => of({ totalDevis: 0, validatedFactures: 0, paidFactures: 0 }))),
            stock: this.statsService.getStockByWarehouse(start, end, centreId).pipe(catchError(() => of([]))),
            clients: this.statsService.getTopClients(10, start, end, centreId).pipe(catchError(() => of([]))),
            payments: this.statsService.getPaymentMethods(start, end, centreId).pipe(catchError(() => of([])))
        }).subscribe({
            next: (data) => {
                this.zone.run(() => {
                    console.timeEnd('📊 [Stats] Backend Data Fetch');
                    this.summary = data.summary;
                    this.loading = false;
                    console.log('📊 [Stats] Data received:', {
                        summary: !!data.summary,
                        revenue: data.revenue?.length,
                        stock: data.stock?.length,
                        stockSample: data.stock?.[0]?.breakdown?.length
                    });
                    this.cdr.detectChanges();

                    // MUST wait for *ngIf="!loading" to render the canvas elements
                    requestAnimationFrame(() => {
                        this.createRevenueChart(data.revenue);
                        const normalizedProducts = this.normalizeProductData(data.products);
                        this.createProductChart(normalizedProducts);
                        this.createConversionChart(data.conversion);
                        this.createStockChart(data.stock);
                        this.createClientsChart(data.clients);
                        this.createPaymentsChart(data.payments);
                        this.cdr.detectChanges();
                    });
                });
            },
            error: (err) => {
                console.timeEnd('📊 [Stats] Backend Data Fetch');
                console.error('❌ [Stats] Error loading stats:', err);
                this.loading = false;
                this.cdr.detectChanges();
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
        if (!this.revenueChartCanvas?.nativeElement) {
            console.error('❌ [Stats] Revenue chart canvas not found');
            return;
        }
        const ctx = this.revenueChartCanvas.nativeElement.getContext('2d');
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
        if (!this.productChartCanvas?.nativeElement) {
            console.error('❌ [Stats] Product chart canvas not found');
            return;
        }
        const ctx = this.productChartCanvas.nativeElement.getContext('2d');
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
        if (!this.conversionChartCanvas?.nativeElement) return;
        const ctx = this.conversionChartCanvas.nativeElement.getContext('2d');
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

    private createStockChart(data: WarehouseStock[]): void {
        if (!this.stockChartCanvas?.nativeElement) return;
        const ctx = this.stockChartCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        if (this.stockChart) {
            this.stockChart.destroy();
        }

        console.log('📊 [Stats] Creating stock chart with', data?.length, 'warehouses');
        if (data?.[0]) {
            console.log('📊 [Stats] First warehouse breakdown:', data[0].breakdown);
        }

        if (!data || data.length === 0) {
            return;
        }

        // Get unique product types across all warehouses (X-Axis labels)
        const allTypesSet = new Set<string>();
        data.forEach(w => {
            w.breakdown?.forEach((b: any) => allTypesSet.add(b.type));
        });
        const allTypes = Array.from(allTypesSet).sort();

        // One dataset per Warehouse (Stacked)
        const colors = [
            '#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0',
            '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#3F51B5'
        ];

        const datasets = data.map((warehouse, index) => ({
            label: warehouse.warehouseName,
            data: allTypes.map(type => {
                const item = warehouse.breakdown?.find((b: any) => b.type === type);
                return item ? item.value : 0;
            }),
            backgroundColor: colors[index % colors.length]
        }));

        this.stockChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: allTypes,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: { display: true, text: 'Type de Produit' }
                    },
                    y: {
                        stacked: true,
                        title: { display: true, text: 'Valeur Stock Réelle (DH)' },
                        ticks: {
                            callback: (value: any) => value.toLocaleString() + ' DH'
                        }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (context: any) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || 0;
                                return `${label}: ${value.toLocaleString()} DH`;
                            }
                        }
                    }
                }
            }
        });
    }

    private createClientsChart(data: any[]): void {
        if (!this.clientsChartCanvas?.nativeElement) return;
        const ctx = this.clientsChartCanvas.nativeElement.getContext('2d');
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
        if (!this.paymentsChartCanvas?.nativeElement) return;
        const ctx = this.paymentsChartCanvas.nativeElement.getContext('2d');
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

    ngOnDestroy(): void {
        // Cleanup charts
        [this.revenueChart, this.productChart, this.conversionChart,
        this.stockChart, this.clientsChart, this.paymentsChart].forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}
