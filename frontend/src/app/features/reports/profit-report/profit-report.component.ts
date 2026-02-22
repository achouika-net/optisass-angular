import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Chart, registerables } from 'chart.js';
import { StatsService } from '../services/stats.service';
import { Store } from '@ngrx/store';
import { TenantSelector } from '../../../core/store/auth/auth.selectors';

Chart.register(...registerables);

@Component({
    selector: 'app-profit-report',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatOptionModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatChipsModule,
        MatTooltipModule,
        FormsModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './profit-report.component.html',
    styleUrls: ['./profit-report.component.scss']
})
export class ProfitReportComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('profitChartCanvas') profitChartCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('evolutionChartCanvas') evolutionChartCanvas!: ElementRef<HTMLCanvasElement>;

    filterType: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL' = 'MONTHLY';
    selectedDate: Date = new Date();
    selectedMonth: number = new Date().getMonth() + 1;
    selectedYear: number = new Date().getFullYear();
    customStartDate: Date | null = null;
    customEndDate: Date | null = null;

    loading = false;
    centreId: string = '';
    activeFilterInfo: string = 'Ce mois';
    data: any = null;
    profitChart: Chart | null = null;
    evolutionChart: Chart | null = null;

    availableMonths = [
        { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
        { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
        { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
        { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' }
    ];
    availableYears: number[] = [];

    constructor(
        private statsService: StatsService,
        private cdref: ChangeDetectorRef,
        private store: Store
    ) { }

    ngOnInit(): void {
        this.initFilterOptions();
        this.store.select(TenantSelector).subscribe(cid => {
            this.centreId = cid || '';
            console.log('[ProfitReport] centreId changed:', this.centreId);
            // Removed 'if (this.centreId)' to allow loading data for 'All Centers'
            this.loadData();
        });
    }

    ngAfterViewInit(): void { }

    ngOnDestroy(): void {
        if (this.profitChart) this.profitChart.destroy();
        if (this.evolutionChart) this.evolutionChart.destroy();
    }

    private initFilterOptions(): void {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            this.availableYears.push(currentYear - i);
        }
    }

    private getDateRange(): { start?: string, end?: string } {
        let start: Date | undefined;
        let end: Date | undefined;

        switch (this.filterType) {
            case 'DAILY':
                start = new Date(this.selectedDate); start.setHours(0, 0, 0, 0);
                end = new Date(this.selectedDate); end.setHours(23, 59, 59, 999);
                this.activeFilterInfo = 'Aujourd\'hui';
                break;
            case 'MONTHLY':
                start = new Date(this.selectedYear, this.selectedMonth - 1, 1, 0, 0, 0, 0);
                end = new Date(this.selectedYear, this.selectedMonth, 0, 23, 59, 59, 999);
                const monthName = this.availableMonths.find(m => m.value === this.selectedMonth)?.label;
                this.activeFilterInfo = `${monthName} ${this.selectedYear}`;
                break;
            case 'YEARLY':
                start = new Date(this.selectedYear, 0, 1, 0, 0, 0, 0);
                end = new Date(this.selectedYear, 12, 0, 23, 59, 59, 999);
                this.activeFilterInfo = `Année ${this.selectedYear}`;
                break;
            case 'CUSTOM':
                if (this.customStartDate && this.customEndDate) {
                    start = new Date(this.customStartDate); start.setHours(0, 0, 0, 0);
                    end = new Date(this.customEndDate); end.setHours(23, 59, 59, 999);
                    this.activeFilterInfo = 'Période personnalisée';
                }
                break;
            case 'ALL':
            default:
                this.activeFilterInfo = 'Tout l\'historique';
                return {};
        }

        return {
            start: start?.toISOString(),
            end: end?.toISOString()
        };
    }

    loadData(): void {
        const dates = this.getDateRange();
        this.loading = true;
        this.cdref.markForCheck();

        const start = dates.start || '';
        const end = dates.end || '';

        console.log(`[ProfitReport] Loading data for period: ${this.activeFilterInfo}`, { start, end, centreId: this.centreId });

        this.statsService.getRealProfit(start, end, this.centreId).subscribe({
            next: (res: any) => {
                console.log('[ProfitReport] Data received:', res);
                this.data = res;
                this.loading = false;
                this.cdref.detectChanges();

                setTimeout(() => {
                    this.createChart(res);
                }, 500);

                this.loadEvolutionData(start, end);
            },
            error: (err: any) => {
                console.error('[ProfitReport] Error loading profit data:', err);
                this.loading = false;
                this.cdref.markForCheck();
            }
        });
    }

    private createChart(data: any): void {
        if (!this.profitChartCanvas?.nativeElement) return;
        const ctx = this.profitChartCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        if (this.profitChart) this.profitChart.destroy();

        this.profitChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Revenu', 'Coût Marchandise (COGS)', 'Dépenses', 'Bénéfice Net'],
                datasets: [{
                    label: 'Montant (DH)',
                    data: [
                        data.revenue,
                        data.cogs,
                        data.expenses,
                        data.netProfit
                    ],
                    backgroundColor: [
                        '#2196F3', // Revenue Blue
                        '#FF9800', // COGS Orange
                        '#F44336', // Expenses Red
                        '#4CAF50'  // Profit Green
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Analyse de Rentabilité'
                    }
                }
            }
        });
    }

    loadEvolutionData(start: string, end: string): void {
        this.statsService.getProfitEvolution(start, end, this.centreId).subscribe({
            next: (data: any[]) => {
                console.log('[ProfitReport] Evolution data received:', data);
                setTimeout(() => {
                    this.createEvolutionChart(data);
                }, 300);
            },
            error: (err: any) => console.error('[ProfitReport] Error loading evolution:', err)
        });
    }

    createEvolutionChart(data: any[]): void {
        if (!this.evolutionChartCanvas?.nativeElement) return;
        const ctx = this.evolutionChartCanvas.nativeElement.getContext('2d');
        if (!ctx) return;

        if (this.evolutionChart) this.evolutionChart.destroy();

        const labels = data.map(d => d.month);
        const revenue = data.map(d => d.revenue);
        const expenses = data.map(d => d.expenses);
        const netProfit = data.map(d => d.netProfit);

        this.evolutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenu',
                        data: revenue,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Dépenses',
                        data: expenses,
                        borderColor: '#F44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Bénéfice Net',
                        data: netProfit,
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.3)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: { display: true, text: 'Évolution Mensuelle du Bénéfice' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => value + ' DH'
                        }
                    }
                }
            }
        });
    }

    setFilterType(type: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL'): void {
        this.filterType = type;
        this.loadData();
    }

    onFilterChange(): void {
        this.loadData();
    }
}
