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
    .container { padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card-metric { text-align: center; padding: 20px; }
    .metric-value { font-size: 34px; font-weight: bold; margin: 12px 0; }
    .metric-label { color: #555; font-size: 16px; font-weight: 500; }
    .chart-container { height: 300px; position: relative; }
    .threshold-container { margin-top: 10px; }
    .threshold-label { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; font-weight: 500; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-wrapper { padding-bottom: 0 !important; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-flex { height: 40px !important; display: flex; align-items: center; }
    ::ng-deep .dense-form-field .mat-mdc-text-field-wrapper { height: 40px !important; padding: 0 12px !important; }
    ::ng-deep .dense-form-field .mat-mdc-form-field-infix { padding-top: 8px !important; padding-bottom: 8px !important; min-height: unset !important; }
    ::ng-deep .dense-form-field .mat-mdc-select-arrow-wrapper { transform: translateY(-2px); }
  `]
})
export class FinanceDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('categoryChart') categoryChartRef!: ElementRef;

    private categoryChart: Chart | null = null;
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
        private zone: NgZone,
        private store: Store
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
        this.financeService.getTreasurySummary(this.currentYear, this.currentMonth, centreId).subscribe({
            next: (data) => {
                this.zone.run(() => {
                    this.summary = data;
                    this.monthlyThreshold = data.monthlyThreshold || 50000;
                    setTimeout(() => this.updateChart(data.categories), 0);
                    this.loading = false;
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

    updateChart(categories: any[]) {
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        const ctx = this.categoryChartRef.nativeElement.getContext('2d');
        this.categoryChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories.map(c => c.name),
                datasets: [{
                    data: categories.map(c => c.value),
                    backgroundColor: this.chartColors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }, // Hide default legend
                    tooltip: {
                        bodyFont: { size: 14 },
                        titleFont: { size: 16 }
                    }
                }
            }
        });
    }

    get percentageUsed(): number {
        if (!this.summary || this.monthlyThreshold === 0) return 0;
        return (this.summary.totalExpenses / this.monthlyThreshold) * 100;
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
