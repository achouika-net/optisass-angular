import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy, ChangeDetectorRef, NgZone, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StatsService, StatsSummary } from '../reports/services/stats.service';
import { FinanceService } from '../finance/services/finance.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../core/store/auth/auth.selectors';

Chart.register(...registerables);

@Component({
    selector: 'app-main-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressBarModule,
        MatSelectModule,
        MatFormFieldModule,
        MatChipsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule,
        FormsModule
    ],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class MainDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('revenueChart') revenueChartRef!: ElementRef;
    @ViewChild('distributionChart') distributionChartRef!: ElementRef;
    @ViewChild('paymentChart') paymentChartRef!: ElementRef;

    loading = false;
    summary: StatsSummary | null = null;
    revenueData: any[] = [];
    topClients: any[] = [];

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

    private charts: Chart[] = [];
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    constructor(
        private statsService: StatsService,
        private financeService: FinanceService,
        private store: Store,
        private cdr: ChangeDetectorRef,
        private zone: NgZone
    ) {
        effect(() => {
            const center = this.currentCentre();
            if (center) {
                // Wrap in setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError if called during initial change detection
                setTimeout(() => this.loadAllData());
            }
        });
    }

    ngOnInit(): void {
        this.initFilterOptions();
        // effect will trigger loadAllData() usually, we can keep this for safety but remove multiple calls 
    }

    ngAfterViewInit(): void {
        // Charts are initialized in loadAllData via setTimeout to ensure ViewChild references are available
    }

    private initFilterOptions(): void {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            this.availableYears.push(currentYear - i);
        }
    }

    setFilterType(type: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL'): void {
        this.filterType = type;
        this.loadAllData();
    }

    onFilterChange(): void {
        this.loadAllData();
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

    loadAllData(): void {
        this.loading = true;
        const dates = this.getDateRange();

        forkJoin({
            summary: this.statsService.getSummary(dates.start, dates.end).pipe(catchError(() => of(null))),
            revenue: this.statsService.getRevenueEvolution('daily', dates.start, dates.end).pipe(catchError(() => of([]))),
            products: this.statsService.getProductDistribution().pipe(catchError(() => of([]))), // Stock distribution is global
            payments: this.statsService.getPaymentMethods(dates.start, dates.end).pipe(catchError(() => of([]))),
            clients: this.statsService.getTopClients(5, dates.start, dates.end).pipe(catchError(() => of([])))
        }).subscribe({
            next: (data) => {
                this.zone.run(() => {
                    this.summary = data.summary;
                    this.revenueData = data.revenue;
                    this.topClients = data.clients;
                    this.loading = false;
                    this.cdr.markForCheck();
                    this.cdr.detectChanges();

                    setTimeout(() => {
                        this.initCharts(data);
                    }, 100);
                });
            },
            error: (err) => {
                console.error('Error loading dashboard data', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private initCharts(data: any): void {
        this.destroyCharts();

        if (this.revenueChartRef) {
            this.charts.push(this.createRevenueChart(data.revenue));
        }
        if (this.distributionChartRef) {
            // Normalize product types before chart creation
            const normalizedProducts = this.normalizeProductData(data.products);
            this.charts.push(this.createDistributionChart(normalizedProducts));
        }
        if (this.paymentChartRef) {
            this.charts.push(this.createPaymentChart(data.payments));
        }
    }

    private normalizeProductData(data: any[]): any[] {
        if (!data) return [];

        const aggregated: { [key: string]: number } = {};

        data.forEach(item => {
            let type = item.type;

            if (['monture', 'Monture', 'MONTURE_OPTIQUE'].includes(type)) {
                type = 'Monture';
            }

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

    private createRevenueChart(data: any[]): Chart {
        const ctx = this.revenueChartRef.nativeElement.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.period),
                datasets: [{
                    label: 'Chiffre d\'Affaires',
                    data: data.map(d => d.revenue),
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: this.getChartOptions('Évolution du Chiffre d\'Affaires')
        });
    }

    private createDistributionChart(data: any[]): Chart {
        const ctx = this.distributionChartRef.nativeElement.getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.type),
                datasets: [{
                    label: 'Valeur du Stock (DH)',
                    data: data.map(d => d.value),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 8,
                    barThickness: 20
                }]
            },
            options: {
                ...this.getChartOptions('Répartition du Stock'),
                indexAxis: 'y'
            }
        });
    }

    private createPaymentChart(data: any[]): Chart {
        const ctx = this.paymentChartRef.nativeElement.getContext('2d');
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.method),
                datasets: [{
                    data: data.map(d => d.totalAmount),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1'],
                    borderWidth: 0,
                    weight: 0.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { family: 'Inter', size: 12 }
                        }
                    }
                }
            }
        });
    }

    private getChartOptions(title: string): ChartConfiguration['options'] {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    displayColors: false
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { size: 11 } }
                }
            }
        };
    }

    private destroyCharts(): void {
        this.charts.forEach(chart => chart.destroy());
        this.charts = [];
    }

    ngOnDestroy(): void {
        this.destroyCharts();
    }

}
