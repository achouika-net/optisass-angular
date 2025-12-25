import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { FinanceService } from '../../services/finance.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
    selector: 'app-finance-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatFormFieldModule,
        MatProgressBarModule
    ],
    templateUrl: './finance-dashboard.component.html',
    styles: [`
    .container { padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card-metric { text-align: center; padding: 20px; }
    .metric-value { font-size: 28px; font-weight: bold; margin: 10px 0; }
    .metric-label { color: #666; font-size: 14px; }
    .chart-container { height: 300px; position: relative; }
    .threshold-container { margin-top: 10px; }
    .threshold-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
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

    constructor(private financeService: FinanceService) { }

    ngOnInit(): void {
        this.loadData();
    }

    ngAfterViewInit() {
        // Initialized when data arrives
    }

    loadData() {
        this.loading = true;
        this.financeService.getTreasurySummary(this.currentYear, this.currentMonth).subscribe({
            next: (data) => {
                this.summary = data;
                setTimeout(() => this.updateChart(data.categories), 0);
                this.loading = false;
            },
            error: (err) => {
                console.error('Erreur dashboard', err);
                this.loading = false;
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
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
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

    get percentageUsed(): number {
        if (!this.summary || this.monthlyThreshold === 0) return 0;
        return (this.summary.totalProjected / this.monthlyThreshold) * 100;
    }

    get thresholdColor(): string {
        const p = this.percentageUsed;
        if (p < 80) return 'primary';
        if (p < 100) return 'accent';
        return 'warn';
    }
}
