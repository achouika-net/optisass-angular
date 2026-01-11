import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, NgZone, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { Chart, registerables } from 'chart.js';
import { Store } from '@ngrx/store';
import { forkJoin } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';

Chart.register(...registerables);

@Component({
    selector: 'app-finance-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatFormFieldModule,
        MatProgressBarModule,
        MatTooltipModule
    ],
    templateUrl: './finance-dashboard.component.html',
    styles: [`
    :host { display: block; width: 100%; }
    .dashboard-wrapper { padding: 24px; background: #f8fafc; min-height: 100vh; width: 100%; box-sizing: border-box; }
    .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    .title-section {
        h1 { font-size: 28px; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px; }
        .subtitle { color: #64748b; margin: 4px 0 0 0; font-size: 14px; }
    }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .kpi-card { padding: 24px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.3); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07); transition: all 0.3s ease; }
    .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.12); }
    .metric-value { font-size: 28px; font-weight: 800; margin: 12px 0; color: #1e293b; }
    .metric-label { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .charts-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 32px; }
    @media (max-width: 1200px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card { border-radius: 20px; border: none; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05); overflow: hidden; height: 100%; }
    .chart-container { height: 350px; position: relative; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-wrapper { padding-bottom: 0 !important; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-flex { height: 44px !important; }
    ::ng-deep .dense-form-field .mat-mdc-text-field-wrapper { height: 44px !important; padding: 0 16px !important; border-radius: 12px !important; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-infix { padding-top: 10px !important; padding-bottom: 10px !important; min-height: unset !important; }
  `]
})
export class FinanceDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('healthChart') healthChartRef!: ElementRef;

    private healthChart: Chart | null = null;

    summary: any = null;
    loading = false;
    currentYear = new Date().getFullYear();
    currentMonth = new Date().getMonth() + 1;

    monthlyThreshold = 50000;
    editingThreshold = false;
    newThreshold = 50000;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    chartColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

    months = [
        { value: 1, label: 'Janvier' },
        { value: 2, label: 'Février' },
        { value: 3, label: 'Mars' },
        { value: 4, label: 'Avril' },
        { value: 5, label: 'Mai' },
        { value: 6, label: 'Juin' },
        { value: 7, label: 'Juillet' },
        { value: 8, label: 'Août' },
        { value: 9, label: 'Septembre' },
        { value: 10, label: 'Octobre' },
        { value: 11, label: 'Novembre' },
        { value: 12, label: 'Décembre' }
    ];
    years: number[] = [];

    constructor(
        private financeService: FinanceService,
        private store: Store,
        private zone: NgZone,
        private cd: ChangeDetectorRef
    ) {
        // Build year list
        const startYear = 2023;
        const endYear = new Date().getFullYear() + 1;
        for (let y = startYear; y <= endYear; y++) {
            this.years.push(y);
        }

        // Reactivity to center and date changes
        effect(() => {
            const center = this.currentCentre();
            // Trigger load when center OR date changes (though date is not a signal, we can call it manually)
            if (center?.id) {
                console.log(`[TREASURY-SYNC] Center detected: ${center.id}, triggering load...`);
                this.loadData();
            }
        });
    }

    ngOnInit(): void {
        // Initial load handled by effect or manual call if needed
        // Since currentCentre is a signal, the effect will run initially.
    }

    toggleEditThreshold() {
        this.editingThreshold = !this.editingThreshold;
        this.newThreshold = this.monthlyThreshold;
    }

    saveThreshold() {
        this.financeService.updateTreasuryConfig(this.newThreshold).subscribe({
            next: () => {
                this.monthlyThreshold = this.newThreshold;
                this.editingThreshold = false;
            },
            error: (err) => console.error('Error saving threshold', err)
        });
    }

    ngAfterViewInit() {
        // Initialized when data arrives
    }

    loadData() {
        this.loading = true;
        const centreId = this.currentCentre()?.id;

        forkJoin({
            monthly: this.financeService.getTreasurySummary(this.currentYear, this.currentMonth, centreId),
            yearly: this.financeService.getYearlyProjection(this.currentYear, centreId)
        }).subscribe({
            next: ({ monthly, yearly }) => {
                this.zone.run(() => {
                    console.log('Dashboard Data Loaded:', { monthly, yearly });
                    this.summary = monthly;
                    this.monthlyThreshold = monthly.monthlyThreshold || 50000;
                    this.loading = false;
                    this.cd.detectChanges(); // Force view update

                    // Update charts after DOM is rendered
                    setTimeout(() => {
                        console.log('Initializing charts...');
                        // this.updateCategoryChart(monthly.categories); // Removed
                        this.updateHealthChart(yearly);
                    }, 100);
                });
            },
            error: (err) => {
                this.zone.run(() => {
                    console.error('Erreur dashboard', err);
                    this.loading = false;
                });
            }
        });
    }



    updateHealthChart(yearlyData: any[]) {
        console.log('updateHealthChart called with:', yearlyData);
        if (this.healthChart) {
            this.healthChart.destroy();
        }

        if (!this.healthChartRef?.nativeElement) {
            console.error('Health Chart Ref is missing!', this.healthChartRef);
            return;
        }

        console.log('Health Chart Ref found, creating chart...');


        // Prepare data for 12 months (ensure alignment with labels)
        const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        const expenses = new Array(12).fill(0);
        const ceiling = this.monthlyThreshold;

        // Fill real data
        if (Array.isArray(yearlyData)) {
            yearlyData.forEach(item => {
                if (item.month >= 1 && item.month <= 12) {
                    expenses[item.month - 1] = item.totalExpenses || 0;
                }
            });
        }

        // Determine colors based on ceiling
        const backgroundColors = expenses.map(val => {
            const p = (val / ceiling) * 100;
            if (p > 100) return '#ef4444'; // Red-500
            if (p > 80) return '#f97316';  // Orange-500
            return '#22c55e';              // Green-500
        });

        const ctx = this.healthChartRef.nativeElement.getContext('2d');
        this.healthChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Plafond',
                        data: new Array(12).fill(ceiling),
                        borderColor: '#9ca3af', // Gray-400
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        order: 0
                    },
                    {
                        type: 'bar',
                        label: 'Dépenses',
                        data: expenses,
                        backgroundColor: backgroundColors,
                        borderRadius: 4,
                        barPercentage: 0.6,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { usePointStyle: true, boxWidth: 8 }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f3f4f6'
                        },
                        ticks: {
                            callback: (value) => {
                                if (typeof value === 'number' && value >= 1000) {
                                    return (value / 1000) + 'k';
                                }
                                return value;
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    get percentageUsed(): number {
        if (!this.summary || this.monthlyThreshold === 0) return 0;
        const amountToCheck = this.summary.totalScheduled !== undefined ? this.summary.totalScheduled : this.summary.totalExpenses;
        return (amountToCheck / this.monthlyThreshold) * 100;
    }

    get thresholdColor(): string {
        const p = this.percentageUsed;
        if (p < 80) return 'primary';
        if (p < 100) return 'accent';
        return 'warn';
    }

    get healthColor(): string {
        const p = this.percentageUsed;
        if (p > 100) return '#f44336'; // Warn/Red
        if (p > 80) return '#ff9800';  // Accent/Orange
        return '#3f51b5';             // Primary/Blue
    }
}
