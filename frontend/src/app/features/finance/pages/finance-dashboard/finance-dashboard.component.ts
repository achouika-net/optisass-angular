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
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';

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
        MatTooltipModule,
        MatChipsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatInputModule
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
    
    /* Unified Filter Toolbar */
    .filter-toolbar {
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        margin-bottom: 32px;
        border: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
    }
    .period-chips {
        display: flex;
        gap: 0.75rem;
        overflow-x: auto;
        padding-bottom: 4px;
    }
    .period-chips .chip-btn {
        border-radius: 9999px;
        font-weight: 600;
        text-transform: none;
        padding: 0 16px !important;
        height: 36px;
        color: #64748b;
        background: #f1f5f9;
        transition: all 0.2s ease;
    }
    .period-chips .chip-btn:hover {
        background: #e2e8f0;
    }
    .period-chips .chip-btn.active {
        background: #3b82f6;
        color: white;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
    }
    .actions-section {
        display: flex;
        align-items: center;
        gap: 16px;
    }
    .actions-section button {
        border-radius: 12px;
        padding: 0 24px;
        height: 48px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }
    .filter-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
    }
    .filter-controls .density-compact {
        width: 180px;
    }
    ::ng-deep .filter-controls .density-compact .mat-mdc-form-field-subscript-wrapper {
        display: none;
    }
    .filter-controls .density-compact.month-field {
        width: 160px;
    }
    .filter-controls .density-compact.year-field {
        width: 120px;
    }

    ::ng-deep .dense-form-field .mat-mdc-form-field-wrapper { padding-bottom: 0 !important; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-flex { height: 44px !important; }
    ::ng-deep .dense-form-field .mat-mdc-text-field-wrapper { height: 44px !important; padding: 0 16px !important; border-radius: 12px !important; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-infix { padding-top: 10px !important; padding-bottom: 10px !important; min-height: unset !important; }
    
    .alert-card {
        background: #fff5f5;
        border: 1px solid #feb2b2;
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 24px;
    }
    .alert-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(226, 232, 240, 0.5);
    }
    .alert-item:last-child { border-bottom: none; }
    .alert-tag {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
    }
    .tag-24h { background: #fee2e2; color: #9b1c1c; }
    .tag-48h { background: #ffedd5; color: #9a3412; }
  `]

})
export class FinanceDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('healthChart') healthChartRef!: ElementRef;

    private healthChart: Chart | null = null;

    summary: any = null;
    loading = false;
    // Filter properties
    filterType: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM' | 'ALL' = 'MONTHLY';
    selectedDate: Date = new Date();
    selectedMonth: number = new Date().getMonth() + 1;
    selectedYear: number = new Date().getFullYear();
    customStartDate: Date | null = null;
    customEndDate: Date | null = null;

    chartColors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    availableMonths = [
        { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' }, { value: 3, label: 'Mars' },
        { value: 4, label: 'Avril' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
        { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' }, { value: 9, label: 'Septembre' },
        { value: 10, label: 'Octobre' }, { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' }
    ];
    availableYears: number[] = [];

    currentYear = new Date().getFullYear();
    monthlyThreshold = 50000;
    editingThreshold = false;
    newThreshold = 50000;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    constructor(
        private financeService: FinanceService,
        private store: Store,
        private zone: NgZone,
        private cd: ChangeDetectorRef
    ) {
        // Reactivity to center changes
        effect(() => {
            const center = this.currentCentre();
            if (center?.id) {
                setTimeout(() => this.loadData());
            }
        });
    }

    ngOnInit(): void {
        this.initFilterOptions();
    }

    private initFilterOptions(): void {
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            this.availableYears.push(currentYear - i);
        }
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
        const dates = this.getDateRange();

        let yearToUse = this.selectedYear;
        if (this.filterType === 'DAILY') {
            yearToUse = this.selectedDate.getFullYear();
        } else if (this.filterType === 'CUSTOM' && this.customStartDate) {
            yearToUse = this.customStartDate.getFullYear();
        } else if (this.filterType === 'ALL') {
            yearToUse = new Date().getFullYear();
        }
        this.currentYear = yearToUse;

        let monthToUse = this.selectedMonth;
        if (this.filterType === 'DAILY') {
            monthToUse = this.selectedDate.getMonth() + 1;
        } else if (this.filterType === 'CUSTOM' && this.customStartDate) {
            monthToUse = this.customStartDate.getMonth() + 1;
        } else if (this.filterType === 'ALL') {
            monthToUse = 0; // Means all months for some backends, but the API uses it. We might just pass 0.
        }

        forkJoin({
            monthly: this.financeService.getTreasurySummary(monthToUse, yearToUse, centreId, dates.start, dates.end),
            yearly: this.financeService.getYearlyProjection(yearToUse, centreId)
        }).subscribe({
            next: ({ monthly, yearly }) => {
                this.zone.run(() => {
                    this.summary = monthly;
                    this.monthlyThreshold = monthly.monthlyThreshold || 50000;
                    this.loading = false;
                    this.cd.detectChanges();

                    // Update charts after DOM is rendered
                    requestAnimationFrame(() => {
                        this.updateHealthChart(yearly);
                    });
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

    isNear(date: string | Date, hours: number): boolean {
        if (!date) return false;
        const d = new Date(date);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        // Alert if date is between now and X hours in the future
        return diff > 0 && diff <= hours * 60 * 60 * 1000;
    }
}

