import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { StatsService } from '../services/stats.service';

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
        MatDatepickerModule,
        MatNativeDateModule,
        FormsModule
    ],
    templateUrl: './profit-report.component.html',
    styleUrls: ['./profit-report.component.scss']
})
export class ProfitReportComponent implements OnInit, AfterViewInit, OnDestroy {
    loading = false;
    startDate: Date | null = null;
    endDate: Date | null = null;

    data: any = null;
    profitChart: Chart | null = null;

    constructor(private statsService: StatsService) { }

    ngOnInit(): void {
        // Default to current month
        const now = new Date();
        this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    ngAfterViewInit(): void {
        setTimeout(() => this.loadData(), 100);
    }

    ngOnDestroy(): void {
        if (this.profitChart) this.profitChart.destroy();
    }

    loadData(): void {
        if (!this.startDate || !this.endDate) return;

        this.loading = true;
        const start = this.startDate.toISOString();
        const end = this.endDate.toISOString();

        this.statsService.getRealProfit(start, end).subscribe({
            next: (res) => {
                this.data = res;
                this.loading = false;
                this.createChart(res);
            },
            error: (err) => {
                console.error('Error loading profit data', err);
                this.loading = false;
            }
        });
    }

    createChart(data: any): void {
        const ctx = document.getElementById('profitChart') as HTMLCanvasElement;
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

    onDateChange(): void {
        this.loadData();
    }
}
