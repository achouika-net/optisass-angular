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

    selectedPeriod: string = 'thisMonth'; // Default

    loading = false;
    startDate: Date | null = null;
    endDate: Date | null = null;

    activeFilterInfo: string = 'Ce mois';

    data: any = null;
    profitChart: Chart | null = null;

    constructor(
        private statsService: StatsService,
        private cdref: ChangeDetectorRef,
        private store: Store
    ) { }

    ngOnInit(): void {
        this.store.select(TenantSelector).subscribe(centreId => {
            if (centreId) {
                this.setPeriod(this.selectedPeriod);
            }
        });
    }

    ngAfterViewInit(): void { }

    ngOnDestroy(): void {
        if (this.profitChart) this.profitChart.destroy();
        if (this.evolutionChart) this.evolutionChart.destroy();
    }

    loadData(): void {
        if (!this.startDate || !this.endDate) {
            console.warn('[ProfitReport] loadData skipped: Missing dates', { start: this.startDate, end: this.endDate });
            return;
        }

        this.loading = true;
        this.cdref.markForCheck();

        const start = this.startDate.toISOString();
        const end = this.endDate.toISOString();

        console.log(`[ProfitReport] Fetching Profit: ${start} to ${end} (Period: ${this.selectedPeriod})`);

        this.statsService.getRealProfit(start, end).subscribe({
            next: (res: any) => {
                this.data = res;
                this.loading = false;
                this.cdref.detectChanges();

                setTimeout(() => {
                    this.createChart(res);
                    this.cdref.detectChanges();
                }, 500);

                // Load evolution as well
                this.loadEvolutionData(start, end);
            },
            error: (err: any) => {
                console.error('Error loading profit data', err);
                this.loading = false;
                this.cdref.markForCheck();
            }
        });
    }

    private createChart(data: any): void {
        if (!this.profitChartCanvas?.nativeElement) {
            console.error('❌ [Profit] Canvas not found');
            return;
        }
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

    evolutionChart: Chart | null = null;

    loadEvolutionData(start: string, end: string): void {
        this.statsService.getProfitEvolution(start, end).subscribe({
            next: (data: any[]) => {
                setTimeout(() => {
                    this.createEvolutionChart(data);
                }, 300);
            },
            error: (err: any) => console.error('Error loading evolution', err)
        });
    }

    createEvolutionChart(data: any[]): void {
        const ctx = document.getElementById('evolutionChart') as HTMLCanvasElement;
        if (!ctx) return;

        if (this.evolutionChart) this.evolutionChart.destroy();

        const labels = data.map(d => d.month); // YYYY-MM
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
                        fill: false, // Don't fill area for main metric
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

    // Updated to accept the event from mat-select or just string
    onPeriodChange(period: string): void {
        this.selectedPeriod = period;
        this.setPeriod(period);
    }

    setPeriod(period: string): void {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case 'thisMonth':
                // Start of current month: Year, Month, 1st day, 00:00:00
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                // End of today (standard view of "this month so far")
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                this.activeFilterInfo = 'Ce mois';
                break;
            case 'lastMonth':
                // Start of previous month
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
                // Last day of previous month (day 0 of current month)
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                this.activeFilterInfo = 'Mois dernier';
                break;
            case 'thisYear':
                // Start of current year
                start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                this.activeFilterInfo = 'Cette année';
                break;
            case 'custom':
                this.activeFilterInfo = 'Période personnalisée';
                return;
        }

        this.startDate = start;
        this.endDate = end;
        this.loadData();
    }

    onDateChange(): void {
        if (this.startDate && this.endDate) {
            this.selectedPeriod = 'custom';
            this.startDate.setHours(0, 0, 0, 0);
            this.endDate.setHours(23, 59, 59, 999);
            this.activeFilterInfo = 'Période personnalisée';
            this.loadData();
        }
    }
}
