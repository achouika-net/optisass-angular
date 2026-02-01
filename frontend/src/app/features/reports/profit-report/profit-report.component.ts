import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
import { Chart, registerables } from 'chart.js';
import { StatsService } from '../services/stats.service';

Chart.register(...registerables);

@Component({
    selector: 'app-profit-report',
    standalone: true,
    imports: [
        // ... existing imports
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
        FormsModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './profit-report.component.html',
    styleUrls: ['./profit-report.component.scss']
})
export class ProfitReportComponent implements OnInit, AfterViewInit, OnDestroy {
    selectedPeriod: string = 'thisMonth'; // Default

    loading = false;
    startDate: Date | null = null;
    endDate: Date | null = null;

    data: any = null;
    profitChart: Chart | null = null;

    constructor(
        private statsService: StatsService,
        private cdref: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.setPeriod('thisMonth');
    }

    ngAfterViewInit(): void {
        // Initial load handled by ngOnInit -> setPeriod
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
            next: (res: any) => {
                this.data = res;
                this.loading = false;

                // Force view update to render *ngIf elements
                this.cdref.detectChanges();

                // Wait for the view to update so the canvas exists
                setTimeout(() => {
                    this.createChart(res);
                }, 300);
            },
            error: (err: any) => {
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
                maintainAspectRatio: false, // Critical for fixed height container
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

    // Updated to accept the event from mat-select or just string
    onPeriodChange(period: string): void {
        this.selectedPeriod = period;
        this.setPeriod(period);
    }

    setPeriod(period: string): void {
        const now = new Date();

        switch (period) {
            case 'thisMonth':
                this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                this.startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                this.endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'thisYear':
                this.startDate = new Date(now.getFullYear(), 0, 1);
                this.endDate = new Date(now.getFullYear(), 11, 31);
                break;
            case 'custom':
                // Do nothing, keep existing dates or let user pick
                return;
        }

        this.loadData();
    }

    onDateChange(): void {
        this.selectedPeriod = 'custom'; // Switch dropdown to custom if user manually picks date
        this.loadData();
    }
}
